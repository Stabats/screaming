import React from 'react';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { translate } from 'react-polyglot';
import { ClassNames, Global, css as coreCss } from '@emotion/react';
import styled from '@emotion/styled';
import { partial, uniqueId } from 'lodash';
import { connect } from 'react-redux';
import { FieldLabel, colors, transitions, lengths, borders } from 'decap-cms-ui-default';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';

import { resolveWidget, getEditorComponents } from '../../../lib/registry';
import { selectInferredField } from '../../../reducers/collections';
import { clearFieldErrors, tryLoadEntry, validateMetaField } from '../../../actions/entries';
import { addAsset, boundGetAsset } from '../../../actions/media';
import { selectIsLoadingAsset } from '../../../reducers/medias';
import { query, clearSearch } from '../../../actions/search';
import {
  openMediaLibrary,
  removeInsertedMedia,
  clearMediaControl,
  removeMediaControl,
  persistMedia,
} from '../../../actions/mediaLibrary';
import Widget from './Widget';

/**
 * This is a necessary bridge as we are still passing classnames to widgets
 * for styling. Once that changes we can stop storing raw style strings like
 * this.
 */
const styleStrings = {
  widget: `
    display: block;
    width: 100%;
    padding: ${lengths.inputPadding};
    margin: 0;
    border: ${borders.textField};
    border-radius: ${lengths.borderRadius};
    border-top-left-radius: 0;
    outline: 0;
    box-shadow: none;
    background-color: ${colors.inputBackground};
    color: #444a57;
    transition: border-color ${transitions.main};
    position: relative;
    font-size: 15px;
    line-height: 1.5;

    select& {
      text-indent: 14px;
      height: 58px;
    }
  `,
  widgetActive: `
    border-color: ${colors.active};
  `,
  widgetError: `
    border-color: ${colors.errorText};
  `,
  disabled: `
    pointer-events: none;
    opacity: 0.5;
    background: #ccc;
  `,
  hidden: `
    visibility: hidden;
  `,
};

const ControlErrorsList = styled.ul`
  list-style-type: none;
  font-size: 12px;
  color: ${colors.errorText};
  margin-bottom: 5px;
  text-align: right;
  text-transform: uppercase;
  position: relative;
  font-weight: 600;
  top: 20px;
`;

export const ControlHint = styled.p`
  margin-bottom: 0;
  padding: 3px 0;
  font-size: 12px;
  color: ${props =>
    props.error ? colors.errorText : props.active ? colors.active : colors.controlLabel};
  transition: color ${transitions.main};
`;

function LabelComponent({ field, isActive, hasErrors, uniqueFieldId, isFieldOptional, t }) {
  const label = `${field.get('label', field.get('name'))}`;
  const labelComponent = (
    <FieldLabel isActive={isActive} hasErrors={hasErrors} htmlFor={uniqueFieldId}>
      {label} {`${isFieldOptional ? ` (${t('editor.editorControl.field.optional')})` : ''}`}
    </FieldLabel>
  );

  return labelComponent;
}

function FieldHintComponent({ fieldHint }) {
  return (
    <ReactMarkdown
      remarkPlugins={[gfm]}
      allowedElements={['a', 'strong', 'em', 'del']}
      unwrapDisallowed={true}
      components={{
        // eslint-disable-next-line no-unused-vars
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }} />
        ),
      }}
    >
      {fieldHint}
    </ReactMarkdown>
  );
}

class EditorControl extends React.Component {
  static propTypes = {
    value: PropTypes.oneOfType([
      PropTypes.node,
      PropTypes.object,
      PropTypes.string,
      PropTypes.bool,
    ]),
    field: ImmutablePropTypes.map.isRequired,
    fieldsMetaData: ImmutablePropTypes.map,
    fieldsErrors: ImmutablePropTypes.map,
    mediaPaths: ImmutablePropTypes.map.isRequired,
    boundGetAsset: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    openMediaLibrary: PropTypes.func.isRequired,
    addAsset: PropTypes.func.isRequired,
    removeInsertedMedia: PropTypes.func.isRequired,
    persistMedia: PropTypes.func.isRequired,
    onValidate: PropTypes.func,
    processControlRef: PropTypes.func,
    controlRef: PropTypes.func,
    query: PropTypes.func.isRequired,
    queryHits: PropTypes.object,
    isFetching: PropTypes.bool,
    clearSearch: PropTypes.func.isRequired,
    clearFieldErrors: PropTypes.func.isRequired,
    loadEntry: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired,
    isEditorComponent: PropTypes.bool,
    isNewEditorComponent: PropTypes.bool,
    parentIds: PropTypes.arrayOf(PropTypes.string),
    entry: ImmutablePropTypes.map.isRequired,
    collection: ImmutablePropTypes.map.isRequired,
    isDisabled: PropTypes.bool,
    isHidden: PropTypes.bool,
    isFieldDuplicate: PropTypes.func,
    isFieldHidden: PropTypes.func,
    locale: PropTypes.string,
  };

  static defaultProps = {
    parentIds: [],
  };

  state = {
    activeLabel: false,
  };

  uniqueFieldId = uniqueId(`${this.props.field.get('name')}-field-`);

  isAncestorOfFieldError = () => {
    const { fieldsErrors } = this.props;

    if (fieldsErrors && fieldsErrors.size > 0) {
      return Object.values(fieldsErrors.toJS()).some(arr =>
        arr.some(err => err.parentIds && err.parentIds.includes(this.uniqueFieldId)),
      );
    }
    return false;
  };

  isFieldTitle = () => {
    const { field, collection } = this.props;

    return field.get('name') === selectInferredField(collection, 'title');
  };

  render() {
    const {
      value,
      entry,
      collection,
      config,
      field,
      fieldsMetaData,
      fieldsErrors,
      mediaPaths,
      boundGetAsset,
      onChange,
      openMediaLibrary,
      clearMediaControl,
      removeMediaControl,
      addAsset,
      removeInsertedMedia,
      persistMedia,
      onValidate,
      processControlRef,
      controlRef,
      query,
      queryHits,
      isFetching,
      clearSearch,
      clearFieldErrors,
      loadEntry,
      className,
      isSelected,
      isEditorComponent,
      isNewEditorComponent,
      parentIds,
      t,
      validateMetaField,
      isLoadingAsset,
      isDisabled,
      isHidden,
      isFieldDuplicate,
      isFieldHidden,
      locale,
    } = this.props;

    const widgetName = field.get('widget');
    const widget = resolveWidget(widgetName);
    const fieldLabel = field.get('label', field.get('name'));
    const fieldName = field.get('name');
    const fieldHint = field.get('hint');
    const fieldPlaceholder =
      field.get('placeholder') ||
      t('editor.editorControl.field.placeholder', {
        fieldLabel: fieldLabel.toLowerCase(),
      });
    const fieldInline = true;
    const isFieldOptional = field.get('required') === false;
    const fieldOptional = isFieldOptional ? t('editor.editorControl.field.optional') : '';
    const isFieldTitle = this.isFieldTitle();
    const onValidateObject = onValidate;
    const metadata = fieldsMetaData && fieldsMetaData.get(fieldName);
    const errors = fieldsErrors && fieldsErrors.get(this.uniqueFieldId);
    const childErrors = this.isAncestorOfFieldError();
    const hasErrors = !!errors || childErrors;

    return (
      <ClassNames>
        {({ css, cx }) => (
          <div
            className={className}
            css={css`
              ${isHidden && styleStrings.hidden};
            `}
          >
            {widget.globalStyles && <Global styles={coreCss`${widget.globalStyles}`} />}
            {/* {errors && (
              <ControlErrorsList>
                {errors.map(
                  error =>
                    error.message &&
                    typeof error.message === 'string' && (
                      <li key={error.message.trim().replace(/[^a-z0-9]+/gi, '-')}>
                        {error.message}
                      </li>
                    ),
                )}
              </ControlErrorsList>
            )} */}
            {/* <LabelComponent
              field={field}
              isActive={isSelected || this.state.styleActive}
              hasErrors={hasErrors}
              uniqueFieldId={this.uniqueFieldId}
              isFieldOptional={isFieldOptional}
              t={t}
            /> */}
            <Widget
              classNameWrapper={cx(
                css`
                  ${styleStrings.widget};
                `,
                {
                  [css`
                    ${styleStrings.widgetActive};
                  `]: isSelected || this.state.styleActive,
                },
                {
                  [css`
                    ${styleStrings.widgetError};
                  `]: hasErrors,
                },
                {
                  [css`
                    ${styleStrings.disabled}
                  `]: isDisabled,
                },
              )}
              classNameWidget={css`
                ${styleStrings.widget};
              `}
              classNameWidgetActive={css`
                ${styleStrings.widgetActive};
              `}
              classNameLabel={css`
                ${styleStrings.label};
              `}
              classNameLabelActive={css`
                ${styleStrings.labelActive};
              `}
              controlComponent={widget.control}
              entry={entry}
              collection={collection}
              config={config}
              field={field}
              uniqueFieldId={this.uniqueFieldId}
              isFieldTitle={isFieldTitle}
              fieldLabel={fieldLabel}
              fieldHint={fieldHint ? FieldHintComponent({ fieldHint }) : null}
              fieldPlaceholder={fieldPlaceholder}
              fieldInline={fieldInline}
              fieldOptional={fieldOptional}
              value={value}
              error={hasErrors}
              errors={errors}
              mediaPaths={mediaPaths}
              metadata={metadata}
              onChange={(newValue, newMetadata) => onChange(field, newValue, newMetadata)}
              onValidate={onValidate && partial(onValidate, this.uniqueFieldId)}
              onOpenMediaLibrary={openMediaLibrary}
              onClearMediaControl={clearMediaControl}
              onRemoveMediaControl={removeMediaControl}
              onRemoveInsertedMedia={removeInsertedMedia}
              onPersistMedia={persistMedia}
              onAddAsset={addAsset}
              getAsset={boundGetAsset}
              hasActiveStyle={isSelected || this.state.styleActive}
              setActiveStyle={() => this.setState({ styleActive: true })}
              setInactiveStyle={() => this.setState({ styleActive: false })}
              resolveWidget={resolveWidget}
              widget={widget}
              getEditorComponents={getEditorComponents}
              ref={processControlRef && partial(processControlRef, field)}
              controlRef={controlRef}
              editorControl={ConnectedEditorControl}
              query={query}
              loadEntry={loadEntry}
              queryHits={queryHits[this.uniqueFieldId] || []}
              clearSearch={clearSearch}
              clearFieldErrors={clearFieldErrors}
              isFetching={isFetching}
              fieldsErrors={fieldsErrors}
              onValidateObject={onValidateObject}
              isEditorComponent={isEditorComponent}
              isNewEditorComponent={isNewEditorComponent}
              parentIds={parentIds}
              t={t}
              validateMetaField={validateMetaField}
              isDisabled={isDisabled}
              isFieldDuplicate={isFieldDuplicate}
              isFieldHidden={isFieldHidden}
              isLoadingAsset={isLoadingAsset}
              locale={locale}
            />
            {/* {fieldHint && (
              <ControlHint active={isSelected || this.state.styleActive} error={hasErrors}>
                <ReactMarkdown
                  remarkPlugins={[gfm]}
                  allowedElements={['a', 'strong', 'em', 'del']}
                  unwrapDisallowed={true}
                  components={{
                    // eslint-disable-next-line no-unused-vars
                    a: ({ node, ...props }) => (
                      <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit' }}
                      />
                    ),
                  }}
                >
                  {fieldHint}
                </ReactMarkdown>
              </ControlHint>
            )} */}
          </div>
        )}
      </ClassNames>
    );
  }
}

function mapStateToProps(state) {
  const { collections, entryDraft } = state;
  const entry = entryDraft.get('entry');
  const collection = collections.get(entryDraft.getIn(['entry', 'collection']));
  const isLoadingAsset = selectIsLoadingAsset(state.medias);

  async function loadEntry(collectionName, slug) {
    const targetCollection = collections.get(collectionName);
    if (targetCollection) {
      const loadedEntry = await tryLoadEntry(state, targetCollection, slug);
      return loadedEntry;
    } else {
      throw new Error(`Can't find collection '${collectionName}'`);
    }
  }

  return {
    mediaPaths: state.mediaLibrary.get('controlMedia'),
    isFetching: state.search.isFetching,
    queryHits: state.search.queryHits,
    config: state.config,
    entry,
    collection,
    isLoadingAsset,
    loadEntry,
    validateMetaField: (field, value, t) => validateMetaField(state, collection, field, value, t),
  };
}

function mapDispatchToProps(dispatch) {
  const creators = bindActionCreators(
    {
      openMediaLibrary,
      clearMediaControl,
      removeMediaControl,
      removeInsertedMedia,
      persistMedia,
      addAsset,
      query,
      clearSearch,
      clearFieldErrors,
    },
    dispatch,
  );
  return {
    ...creators,
    boundGetAsset: (collection, entry) => boundGetAsset(dispatch, collection, entry),
  };
}

function mergeProps(stateProps, dispatchProps, ownProps) {
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    boundGetAsset: dispatchProps.boundGetAsset(stateProps.collection, stateProps.entry),
  };
}

const ConnectedEditorControl = connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
)(translate()(EditorControl));

export default ConnectedEditorControl;
