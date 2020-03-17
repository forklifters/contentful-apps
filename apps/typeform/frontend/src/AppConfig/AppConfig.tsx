import React from 'react';
import { AppExtensionSDK } from 'contentful-ui-extensions-sdk';
import get from 'lodash/get';
import {
  Heading,
  Paragraph,
  Typography,
  TextField,
  TextLink,
  Select,
  Option,
  FormLabel
} from '@contentful/forma-36-react-components';
import TypeformAuth from '../Auth';
import FieldSelector from './FieldSelector';
import {
  CompatibleFields,
  ContentType,
  Hash,
  EditorInterface,
  InstallationParameters,
  SelectedFields,
  WorkspaceOption,
  WorkspacesResponse
} from '../typings';
import {
  getCompatibleFields,
  editorInterfacesToSelectedFields,
  selectedFieldsToTargetState,
  validateParamameters
} from '../utils';

import { styles } from './styles';

// @ts-ignore 2307
import logo from './config-screen-logo.svg';

interface Props {
  sdk: AppExtensionSDK;
}

interface State {
  workspaceId: string;
  accessToken: string | null;
  workspaces: WorkspaceOption[];
  contentTypes: ContentType[];
  selectedContentTypes: string[];
  selectedFields: SelectedFields;
  compatibleFields: CompatibleFields;
}

export class AppConfig extends React.Component<Props, State> {
  state: State = {
    contentTypes: [],
    compatibleFields: {},
    workspaces: [],
    selectedContentTypes: [],
    selectedFields: {},
    workspaceId: '',
    accessToken: window.localStorage.getItem('token') as string
  };

  async componentWillMount() {
    const { sdk } = this.props;

    sdk.app.onConfigure(this.onAppConfigure);

    const [contentTypesResponse, eisResponse, paramsResponse] = await Promise.all([
      sdk.space.getContentTypes(),
      sdk.space.getEditorInterfaces(),
      sdk.app.getParameters(),
      this.fetchWorkspaces()
    ]);

    const contentTypes = (contentTypesResponse as Hash).items as ContentType[];
    const editorInterfaces = (eisResponse as Hash).items as EditorInterface[];
    console.log(this.state.workspaces);
    const compatibleFields = getCompatibleFields(contentTypes);
    const filteredContentTypes = contentTypes.filter(ct => {
      const fields = compatibleFields[ct.sys.id];
      return fields && fields.length > 0;
    });

    const parameters: InstallationParameters = paramsResponse as InstallationParameters;

    this.setState(
      {
        accessToken: get(parameters, ['accessToken'], ''),
        workspaceId: get(parameters, ['workspaceId'], ''),
        compatibleFields,
        contentTypes: filteredContentTypes,
        selectedFields: editorInterfacesToSelectedFields(editorInterfaces, sdk.ids.app)
      },
      () => sdk.app.setReady()
    );
  }

  fetchWorkspaces = async () => {
    try {
      const response = await fetch(`http://localhost:3000/workspaces/${this.state.accessToken}`);
      const result: WorkspacesResponse = await response.json();
      console.log(result);
      this.setState({ workspaces: this.normalizeWorkspaceReponse(result) });
    } catch (error) {
      console.error(error);
    }
  };

  normalizeWorkspaceReponse = (response: WorkspacesResponse) => {
    return response.workspaces.items.map(workspace => ({
      name: workspace.name,
      id: workspace.id
    }));
  };

  onAppConfigure = () => {
    const { accessToken, workspaceId, contentTypes, selectedFields } = this.state;
    const parameters = { accessToken, workspaceId };
    const error = validateParamameters(parameters);

    if (error) {
      this.props.sdk.notifier.error(error);
      return false;
    }

    return {
      parameters: { accessToken, workspaceId },
      targetState: selectedFieldsToTargetState(contentTypes, selectedFields)
    };
  };

  setWorkSpaceId = (id: string) => {
    this.setState({ workspaceId: id.trim() });
  };

  setAccessToken = (token: string) => {
    this.setState({ accessToken: token.trim() });
  };

  onSelectedFieldsChange = (selectedFields: SelectedFields) => {
    this.setState({ selectedFields });
  };

  render() {
    const { contentTypes, compatibleFields, selectedFields } = this.state;
    const { sdk } = this.props;

    return (
      <div>
        <div className={styles.background('#262627')} />
        <div className={styles.body}>
          <div>
            <div>
              <Typography>
                <Heading>About Typeform</Heading>
                <Paragraph className={styles.aboutP}>
                  The{' '}
                  <TextLink
                    href="https://www.typeform.com/"
                    target="_blank"
                    rel="noopener noreferrer">
                    Typeform
                  </TextLink>{' '}
                  app allows you to reference your forms from Typeform without leaving Contentful.
                </Paragraph>
              </Typography>
              <hr className={styles.splitter} />
            </div>
            <div>
              <Typography>
                <Heading>Configuration</Heading>
                <FormLabel htmlFor="workspaceId" required>
                  Select the Typeform workspace you want to connect
                </FormLabel>
                <Select
                  id="workspaceId"
                  name="workspaceId"
                  onChange={(event: any) => this.setWorkSpaceId(event.currentTarget.value)}
                  value={this.state.workspaceId}
                  data-test-id="typeform-select">
                  <Option key="" value="">
                    {this.state.workspaces.length === 0
                      ? 'No workspaces available'
                      : 'Choose workspace'}
                  </Option>
                  {this.state.workspaces.map(workspace => (
                    <Option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </Option>
                  ))}
                </Select>
              </Typography>
              <hr className={styles.splitter} />
              <Typography>
                <Heading>Assign to content types</Heading>
                {contentTypes.length > 0 ? (
                  <>
                    <Paragraph>Select which content types to use with Typeform App.</Paragraph>
                    <FieldSelector
                      contentTypes={contentTypes}
                      compatibleFields={compatibleFields}
                      selectedFields={selectedFields}
                      onSelectedFieldsChange={this.onSelectedFieldsChange}
                    />
                  </>
                ) : (
                  <Paragraph>
                    No content types with fields of type <strong>Short Text</strong> were found.
                  </Paragraph>
                )}
              </Typography>
            </div>
          </div>
        </div>
        <div className={styles.icon}>
          <img src={logo} alt="typeform logo" />
        </div>
      </div>
    );
  }
}