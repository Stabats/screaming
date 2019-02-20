import { filter, flow, fromPairs, map } from "lodash/fp";
import minimatch from "minimatch";

//
// Pointer file parsing

const splitIntoLines = str => str.split("\n");
const splitIntoWords = str => str.split(/\s+/g);
const isNonEmptyString = str => str !== "";
const withoutEmptyLines = flow([
  map(str => str.trim()),
  filter(isNonEmptyString)
]);
export const parsePointerFile = flow([
  splitIntoLines,
  withoutEmptyLines,
  map(splitIntoWords),
  fromPairs,
  ({ size, oid, ...rest }) => ({
    size: parseInt(size),
    sha: oid.split(":")[1],
    ...rest
  })
]);

export const createPointerFile = ({ size, sha }) => `\
version https://git-lfs.github.com/spec/v1
oid sha256:${sha}
size ${size}
`;

//
// .gitattributes file parsing

const removeGitAttributesCommentsFromLine = line => line.split("#")[0];

const parseGitPatternAttribute = attributeString => {
  // There are three kinds of attribute settings:
  // - a key=val pair sets an attribute to a specific value
  // - a key without a value and a leading hyphen sets an attribute to false
  // - a key without a value and no leading hyphen sets an attribute
  //   to true
  if (attributeString.includes("=")) {
    return attributeString.split("=");
  }
  if (attributeString.startsWith("-")) {
    return [attributeString.slice(1), false];
  }
  return [attributeString, true];
};

const parseGitPatternAttributes = flow([
  map(parseGitPatternAttribute),
  fromPairs
]);

const parseGitAttributesPatternLine = flow([
  splitIntoWords,
  ([pattern, ...attributes]) => [pattern, parseGitPatternAttributes(attributes)]
]);

const parseGitAttributesFileToPatternAttributePairs = flow([
  splitIntoLines,
  map(removeGitAttributesCommentsFromLine),
  withoutEmptyLines,
  map(parseGitAttributesPatternLine)
]);

export const getLargeMediaPatternsFromGitAttributesFile = flow([
  parseGitAttributesFileToPatternAttributePairs,
  filter(
    ([pattern, attributes]) =>
      attributes.filter === "lfs" &&
      attributes.diff === "lfs" &&
      attributes.merge === "lfs"
  ),
  map(([pattern]) => pattern)
]);

export const matchPath = ({ patterns }, path) =>
  patterns.some(pattern => minimatch(path, pattern, { matchBase: true }));

//
// API interactions

const defaultContentHeaders = {
  Accept: "application/vnd.git-lfs+json",
  ["Content-Type"]: "application/vnd.git-lfs+json"
};

const resourceExists = async (
  { rootUrl, makeAuthorizedRequest },
  { sha, size }
) => {
  const response = await makeAuthorizedRequest({
    url: `${rootUrl}/verify`,
    method: "POST",
    headers: defaultContentHeaders,
    body: JSON.stringify({ oid: sha, size })
  });
  if (response.ok) {
    return true;
  }
  if (response.status === 404) {
    return false;
  }

  // TODO: what kind of error to throw here? APIError doesn't seem
  // to fit
};

const getDownloadUrlThunkFromSha = (
  { rootUrl, makeAuthorizedRequest, transformImages: t },
  sha
) => () =>
  makeAuthorizedRequest(
    `${rootUrl}/origin/${sha}${
      t && Object.keys(t).length > 0
        ? `?nf_resize=${t.nf_resize}&w=${t.w}&h=${t.h}`
        : ""
    }`
  )
    .then(res => (res.ok ? res : Promise.reject(res)))
    .then(res => res.blob())
    .then(blob => URL.createObjectURL(blob))
    .catch(err => console.error(err) || Promise.resolve(""));

// We allow users to get thunks which load the blobs instead of fully
// resolved blob URLs so that media clients can download the blobs
// lazily.  This behaves more similarly to the behavior of string
// URLs, which only trigger an image download when the DOM element for
// that image is created.
const getResourceDownloadUrlThunks = (clientConfig, objects) =>
  Promise.resolve(
    objects.map(({ sha }) => [
      sha,
      getDownloadUrlThunkFromSha(clientConfig, sha)
    ])
  );

const getResourceDownloadUrls = (clientConfig, objects) =>
  getResourceDownloadUrlThunks(clientConfig, objects)
    .then(map(([sha, thunk]) => Promise.all([sha, thunk()])))
    .then(Promise.all.bind(Promise));

const uploadOperation = objects => ({
  operation: "upload",
  transfers: ["basic"],
  objects: objects.map(({ sha, ...rest }) => ({ ...rest, oid: sha }))
});

const getResourceUploadUrls = async (
  { rootUrl, makeAuthorizedRequest },
  objects
) => {
  const response = await makeAuthorizedRequest({
    url: `${rootUrl}/objects/batch`,
    method: "POST",
    headers: defaultContentHeaders,
    body: JSON.stringify(uploadOperation(objects))
  });
  return (await response.json()).objects.map(object => {
    if (object.error) {
      throw new Error(object.error.message);
    }
    return object.actions.upload.href;
  });
};

const uploadBlob = (clientConfig, uploadUrl, blob) =>
  fetch(uploadUrl, {
    method: "PUT",
    body: blob
  });

const uploadResource = async (clientConfig, { sha, size }, resource) => {
  const existingFile = await resourceExists(clientConfig, { sha, size });
  if (existingFile) {
    return sha;
  }
  const [uploadUrl] = await getResourceUploadUrls(clientConfig, [
    { sha, size }
  ]);
  await uploadBlob(clientConfig, uploadUrl, resource);
  return sha;
};

//
// Create Large Media client

const configureFn = (config, fn) => (...args) => fn(config, ...args);
const clientFns = {
  resourceExists,
  getResourceUploadUrls,
  getResourceDownloadUrls,
  getResourceDownloadUrlThunks,
  uploadResource,
  matchPath
};
export const getClient = clientConfig => {
  return flow([
    Object.keys,
    map(key => [key, configureFn(clientConfig, clientFns[key])]),
    fromPairs,
    configuredFns => ({
      ...configuredFns,
      patterns: clientConfig.patterns,
      enabled: clientConfig.enabled
    })
  ])(clientFns);
};
