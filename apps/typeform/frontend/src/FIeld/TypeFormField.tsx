import React, { useEffect, useReducer } from 'react';
import { FieldExtensionSDK } from 'contentful-ui-extensions-sdk';
import { Select, Option, TextLink, Note, Tooltip } from '@contentful/forma-36-react-components';
import { TypeFormResponse, FormOption, InstallationParameters } from '../typings';
import { styles } from './styles';
// @ts-ignore 2307
import logo from './typeform-icon.svg';

interface Props {
  sdk: FieldExtensionSDK;
}

enum ACTION_TYPES {
  INIT = 'INIT',
  UPDATE_VALUE = 'UPDATE_VALUE',
  RESET = 'RESET',
  ERROR = 'ERROR'
}

const initialState = {
  error: false,
  value: '',
  selectedForm: {
    name: '',
    href: '',
    isPublic: true,
    id: ''
  } as FormOption,
  hasStaleData: false,
  forms: [] as FormOption[],
  loading: true
};

const isStaleData = (value: string, forms: FormOption[]): boolean => {
  if (!value || forms.length === 0) {
    return false;
  }
  // If the currrent value was found in the fetched forms
  // we do not have stale data
  return !forms.find(form => form.href === value);
};

const getSelectedForm = (value: string, forms: FormOption[]) => {
  return forms.find(form => form.href === value) || initialState.selectedForm;
};

export function TypeFormField({ sdk }: Props) {
  const { workspaceId, accessToken } = sdk.parameters.installation as InstallationParameters;
  const [state, dispatch] = useReducer(reducer, initialState);
  const { loading, forms, value, hasStaleData, selectedForm, error } = state;

  function reducer(
    state = initialState,
    action: { type: string; payload?: any }
  ): typeof initialState {
    switch (action.type) {
      case ACTION_TYPES.INIT: {
        const { forms } = action.payload;
        const currentFieldValue = sdk.field.getValue();
        const hasStaleData = isStaleData(currentFieldValue, forms);
        return {
          ...state,
          value: currentFieldValue,
          selectedForm: getSelectedForm(currentFieldValue, forms),
          loading: false,
          forms,
          hasStaleData
        };
      }
      case ACTION_TYPES.UPDATE_VALUE: {
        const { value, forms } = action.payload;
        let selectedForm = initialState.selectedForm;
        if (value) {
          sdk.field.setValue(value);
          selectedForm = (forms as FormOption[]).find(form => form.href === value)!;
        } else {
          selectedForm = initialState.selectedForm;
          sdk.field.removeValue();
        }
        return { ...state, value, selectedForm, hasStaleData: false };
      }
      case ACTION_TYPES.RESET: {
        sdk.field.removeValue();
        return {
          ...state,
          value: '',
          hasStaleData: false,
          selectedForm: initialState.selectedForm
        };
      }
      case ACTION_TYPES.ERROR: {
        return { ...state, loading: false, error: true };
      }
      default:
        return state;
    }
  }

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const response = (await (
          await fetch(`http://localhost:3000/forms/${workspaceId}/${accessToken}`)
        ).json()) as TypeFormResponse;
        const normalizedForms = normalizeFormResponse(response);
        console.log('got', response);
        dispatch({
          type: ACTION_TYPES.INIT,
          payload: {
            forms: normalizedForms
          }
        });
      } catch (error) {
        console.error(error);
        dispatch({ type: ACTION_TYPES.ERROR });
      }
    };
    fetchForms();
    // Start auto resizer to adjust field height
    sdk.window.startAutoResizer();
  }, []);

  const onChange = (event: any) => {
    const value = event.currentTarget.value;
    dispatch({ type: ACTION_TYPES.UPDATE_VALUE, payload: { value, forms } });
  };

  const openDialog = async () => {
    await sdk.dialogs.openCurrentApp({
      width: 1000,
      parameters: {
        value
      },
      title: 'Form Preview',
      shouldCloseOnEscapePress: true,
      shouldCloseOnOverlayClick: true
    });
  };

  const normalizeFormResponse = (typeFormResponse: TypeFormResponse): FormOption[] => {
    return typeFormResponse.forms.items.map(form => ({
      name: form.title,
      href: form._links.display,
      id: form.id,
      isPublic: form.settings.is_public
    }));
  };

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <Note noteType="negative">
        We could not fetch your typeforms. Please make sure you are using a valid workspace ID and
        access token.
      </Note>
    );
  }

  const PreviewButton = (
    <div className={styles.previewButton(!selectedForm.isPublic)}>
      <TextLink onClick={openDialog} disabled={!selectedForm.isPublic}>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M0 0h24v24H0z" fill="none" />
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
        </svg>
        Preview
      </TextLink>
    </div>
  );

  return (
    <React.Fragment>
      <div className={styles.field}>
        <img src={logo} className={styles.logo} />
        <Select onChange={onChange} value={value} data-test-id="typeform-select">
          <Option key="" value="">
            {forms.length === 0 ? 'No forms available' : 'Choose typeform'}
          </Option>
          {forms.map(form => (
            <Option key={form.id} value={form.href}>
              {form.name}
            </Option>
          ))}
        </Select>
      </div>
      {value && !hasStaleData && (
        <div className={styles.actionButtons}>
          {selectedForm.isPublic ? (
            PreviewButton
          ) : (
            <Tooltip
              containerElement="span"
              content="You can not preview this typeform because it is private"
              place="right">
              {PreviewButton}
            </Tooltip>
          )}
          <TextLink
            href={`https://admin.typeform.com/form/${selectedForm.id}/create`}
            target="_blank"
            icon="ExternalLink"
            rel="noopener noreferrer"
            className={styles.editButton}
            disabled={!value}>
            Edit
          </TextLink>
        </div>
      )}
      {hasStaleData && (
        <Note noteType="negative">
          The typeform you have selected in Contentful no longer exists in typeform.{' '}
          <TextLink onClick={() => dispatch({ type: ACTION_TYPES.RESET })}>Clear field</TextLink>.
        </Note>
      )}
    </React.Fragment>
  );
}
