import React from 'react';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import styled from 'react-emotion';
import EditorControl from './EditorControl';

const ControlPaneContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 16px;

  p {
    font-size: 16px;
  }
`

export default class ControlPane extends React.Component {
  componentValidate = {};

  processControlRef = (fieldName, wrappedControl) => {
    if (!wrappedControl) return;
    this.componentValidate[fieldName] = wrappedControl.validate;
  };

  validate = () => {
    this.props.fields.forEach((field) => {
      if (field.get('widget') === 'hidden') return;
      this.componentValidate[field.get("name")]();
    });
  };

  render() {
    const {
      collection,
      fields,
      entry,
      fieldsMetaData,
      fieldsErrors,
      onChange,
      onValidate,
    } = this.props;

    if (!collection || !fields) {
      return null;
    }

    if (entry.size === 0 || entry.get('partial') === true) {
      return null;
    }

    return (
      <ControlPaneContainer>
        {fields.map((field, i) => field.get('widget') === 'hidden' ? null :
          <EditorControl
            key={i}
            field={field}
            value={entry.getIn(['data', field.get('name')])}
            fieldsMetaData={fieldsMetaData}
            fieldsErrors={fieldsErrors}
            onChange={onChange}
            onValidate={onValidate}
            processControlRef={this.processControlRef}
          />
        )}
      </ControlPaneContainer>
    );
  }
}

ControlPane.propTypes = {
  collection: ImmutablePropTypes.map.isRequired,
  entry: ImmutablePropTypes.map.isRequired,
  fields: ImmutablePropTypes.list.isRequired,
  fieldsMetaData: ImmutablePropTypes.map.isRequired,
  fieldsErrors: ImmutablePropTypes.map.isRequired,
  onChange: PropTypes.func.isRequired,
  onValidate: PropTypes.func.isRequired,
};
