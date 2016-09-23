import { currentBackend } from '../backends/backend';
import { currentSearchIntegration } from '../integrations/search';
import { getMedia } from '../reducers';

/*
 * Contant Declarations
 */
export const ENTRY_REQUEST = 'ENTRY_REQUEST';
export const ENTRY_SUCCESS = 'ENTRY_SUCCESS';
export const ENTRY_FAILURE = 'ENTRY_FAILURE';

export const ENTRIES_REQUEST = 'ENTRIES_REQUEST';
export const ENTRIES_SUCCESS = 'ENTRIES_SUCCESS';
export const ENTRIES_FAILURE = 'ENTRIES_FAILURE';

export const DRAFT_CREATE_FROM_ENTRY = 'DRAFT_CREATE_FROM_ENTRY';
export const DRAFT_CREATE_EMPTY = 'DRAFT_CREATE_EMPTY';
export const DRAFT_DISCARD = 'DRAFT_DISCARD';
export const DRAFT_CHANGE = 'DRAFT_CHANGE';

export const ENTRY_PERSIST_REQUEST = 'ENTRY_PERSIST_REQUEST';
export const ENTRY_PERSIST_SUCCESS = 'ENTRY_PERSIST_SUCCESS';
export const ENTRY_PERSIST_FAILURE = 'ENTRY_PERSIST_FAILURE';

/*
 * Simple Action Creators (Internal)
 */
function entryLoading(collectionStr, slug) {
  return {
    type: ENTRY_REQUEST,
    payload: {
      collection: collectionStr,
      slug: slug
    }
  };
}

function entryLoaded(collectionStr, entry) {
  return {
    type: ENTRY_SUCCESS,
    payload: {
      collection: collectionStr,
      entry: entry
    }
  };
}

function entriesLoading(collection) {
  return {
    type: ENTRIES_REQUEST,
    payload: {
      collection: collection.get('name')
    }
  };
}

function entriesLoaded(collection, entries, pagination) {
  return {
    type: ENTRIES_SUCCESS,
    payload: {
      collection: collection.get('name'),
      entries: entries,
      pages: pagination
    }
  };
}

function entriesFailed(collection, error) {
  return {
    type: ENTRIES_FAILURE,
    error: 'Failed to load entries',
    payload: error.toString(),
    meta: { collection: collection.get('name') }
  };
}

function entryPersisting(collection, entry) {
  return {
    type: ENTRY_PERSIST_REQUEST,
    payload: {
      collection: collection,
      entry: entry
    }
  };
}

function entryPersisted(collection, entry) {
  return {
    type: ENTRY_PERSIST_SUCCESS,
    payload: {
      collection: collection,
      entry: entry
    }
  };
}

function entryPersistFail(collection, entry, error) {
  return {
    type: ENTRIES_FAILURE,
    error: 'Failed to persist entry',
    payload: error.toString()
  };
}

function emmptyDraftCreated(entry) {
  return {
    type: DRAFT_CREATE_EMPTY,
    payload: entry
  };
}

/*
 * Exported simple Action Creators
 */
export function createDraftFromEntry(entry) {
  return {
    type: DRAFT_CREATE_FROM_ENTRY,
    payload: entry
  };
}

export function discardDraft() {
  return {
    type: DRAFT_DISCARD
  };
}

export function changeDraft(entry) {
  return {
    type: DRAFT_CHANGE,
    payload: entry
  };
}

/*
 * Exported Thunk Action Creators
 */
export function loadEntry(collection, slug, path) {
  return (dispatch, getState) => {
    const state = getState();
    const backend = currentBackend(state.config);
    dispatch(entryLoading(collection.get('name'), slug));
    return backend.entry(collection, slug)
      .then((entry) => dispatch(entryLoaded(collection.get('name'), entry)));
  };
}

export function loadEntryRemainingData(entry) {
  return (dispatch, getState) => {
    const state = getState();
    const config = state.config;
    const backend = currentBackend(config);
    dispatch(entryLoading(entry.get('collection'), entry.get('path')));

    return backend.getEntry(entry.get('collection'), entry.get('slug'), entry.get('path'))
      .then((completeEntry) => dispatch(entryLoaded(entry.get('collection'), completeEntry)));
  };
}

export function loadEntries(collection) {
  return (dispatch, getState) => {
    if (collection.get('isFetching')) { return; }
    const state = getState();
    const config = state.config;
    const useSearch = config.getIn(['integrations', 'search', 'use_for_listing'], false);

    const provider = useSearch ? currentSearchIntegration(state.config) : currentBackend(state.config);

    dispatch(entriesLoading(collection));
    provider.entries(collection).then(
      (response) => dispatch(entriesLoaded(collection, response.entries, response.pagination)),
      (error) => dispatch(entriesFailed(collection, error))
    );
  };
}

export function createEmptyDraft(collection) {
  return (dispatch, getState) => {
    const state = getState();
    const backend = currentBackend(state.config);
    const newEntry = backend.newEntry(collection);
    dispatch(emmptyDraftCreated(newEntry));
  };
}

export function persistEntry(collection, entry) {
  return (dispatch, getState) => {
    const state = getState();
    const backend = currentBackend(state.config);
    const MediaProxies = entry.get('mediaFiles').map(path => getMedia(state, path));
    dispatch(entryPersisting(collection, entry));
    backend.persistEntry(state.config, collection, entry, MediaProxies.toJS()).then(
      () => {
        dispatch(entryPersisted(collection, entry));
      },
      (error) => dispatch(entryPersistFail(collection, entry, error))
    );
  };
}
