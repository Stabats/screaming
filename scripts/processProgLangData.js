const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const uniq = require('lodash/uniq');

async function fetchData() {
  const filePath = path.join(__dirname, 'prog-lang-data-raw.yml');
  const fileContent = await fs.readFile(filePath);
  return yaml.safeLoad(fileContent);
}

async function outputData(data) {
  const filePath = path.join(__dirname, 'prog-lang-data.yml');
  return fs.outputFile(filePath, yaml.safeDump(data));
}

function transform(data) {
  return Object.entries(data).reduce((acc, [label, lang]) => {
    const { extensions = [], aliases = [], codemirror_mode, codemirror_mime_type } = lang;
    if (codemirror_mode) {
      const dotlessExtensions = extensions.map(ext => ext.slice(1));
      const identifiers = uniq([
        label.toLowerCase(),
        ...aliases,
        ...dotlessExtensions,
      ].filter(alias => {
        if (!alias) {
          return
        }
        return !/[^a-zA-Z]/.test(alias);
      }));
      acc.push({ label, identifiers, codemirror_mode, codemirror_mime_type });
    }
    return acc;
  }, []);
}

async function process() {
  const data = await fetchData();
  const transformedData = transform(data);
  return outputData(transformedData);
}

process();
