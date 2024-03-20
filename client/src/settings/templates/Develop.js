'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {
    ACEEditor,
    Button,
    filterData,
    Form,
    FormSendMethod,
    withForm
} from "../../lib/form";
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-jsx';
import 'ace-builds/src-noconflict/mode-scss';
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import {Panel} from "../../lib/panel";
import developStyles
    from "./Develop.scss";
import {
    ActionLink,
    Icon
} from "../../lib/bootstrap-components";
import Preview
    from "./Preview";
import Files
    from "../../lib/files";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "react-i18next";
import {withTranslationCustom} from "../../lib/i18n";

const SaveState = {
    SAVED: 0,
    SAVING: 1,
    CHANGED: 2
};

const defaultEditorHeight = 600;

@withComponentMixins([
    withTranslationCustom,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class Develop extends Component {
    constructor(props) {
        super(props);

        this.templateTypes = this.getTemplateTypes();

        this.state = {
            activeTab: null,
            saveState: SaveState.SAVED,
            isMaximized: false,
            withPreview: true,
            editorHeight: defaultEditorHeight,
            templateVersionId: 0,
            fileToDeleteName: null,
            fileToDeleteId: null
        };

        const t = props.t;

        this.saveLabels = {
            [SaveState.CHANGED]: t('Save'),
            [SaveState.SAVED]: t('Saved'),
            [SaveState.SAVING]: t('Saving...')
        };

        this.initForm({
            onChange: (newState, key) => {
                const templateType = newState.formState.getIn(['data', 'type', 'value']);
                if (this.templateTypes[templateType].changedKeys.has(key)) {
                    newState.saveState = SaveState.CHANGED;
                }
            }
        });
    }


    static propTypes = {
        entity: PropTypes.object.isRequired
    };

    getTemplateTypes() {
        const t = this.props.t;
        const templateTypes = {};

        const columns = [
            {data: 1, title: "Name"},
            {data: 2, title: "Size"},
            {
                actions: data => {

                    const actions = [
                        {
                            label: <Icon icon="download" title={t('Download')}/>,
                            href: `rest/template-file-download/${data[0]}`
                        },
                        {
                            label: <Icon icon="remove" title={t('Delete')}/>,
                            action: () => this.deleteFile(data[0], data[1])
                        }
                    ];

                    return actions;
                }
            }
        ];

        templateTypes.jsx = {
            changedKeys: new Set(['jsx', 'scss', 'files', 'params']),
            tabs: [
                {
                    id: 'jsx',
                    default: true,
                    label: t('JSX'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="jsx" mode="jsx"
                                                 format="wide"/>
                },
                {
                    id: 'scss',
                    label: t('SCSS'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="scss" mode="scss"
                                                 format="wide"/>
                },
                {
                    id: 'files',
                    label: t('Files'),
                    getContent: () => <Files entity={this.props.entity} entityTypeId="template" entitySubTypeId="file"
                                             managePermission="manageFiles"/>
                },
                {
                    id: 'params',
                    label: t('Parameters'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="params" mode="json"
                                                 format="wide"/>
                }
            ],
            dataIn: data => {
                data.jsx = data.settings.jsx;
                data.scss = data.settings.scss;
                data.params = JSON.stringify(data.settings.params, null, '  ');
            },
            dataOut: data => {
                data.settings.jsx = data.jsx;
                data.settings.scss = data.scss;
                data.settings.params = JSON.parse(data.params);
                delete data.jsx;
                delete data.scss;
                delete data.params;
            },
            validate: state => {
                const paramsStr = state.getIn(['params', 'value']);
                try {
                    const params = JSON.parse(paramsStr);

                    if (!Array.isArray(params)) {
                        state.setIn(['params', 'error'], t('Parameters specification has to be a valid JSON array.'));
                    } else {
                        state.setIn(['params', 'error'], null);
                    }
                } catch (err) {
                    state.setIn(['params', 'error'], t('Parameters specification is not a valid JSON array. ') + err.message);
                }
            }
        }

        return templateTypes;
    }

    getFormValuesMutator(data) {
       this.inputMutator(data);
    }

    inputMutator(data) {
        this.templateTypes[data.type].dataIn(data);
    }

    resizeTabPaneContent() {
        if (this.tabPaneContentNode) {
            let desiredHeight;
            const tabPaneContentNodeRect = this.tabPaneContentNode.getBoundingClientRect();

            if (this.state.isMaximized) {
                desiredHeight = window.innerHeight - tabPaneContentNodeRect.top;
            } else {
                // This number gives some space related to padding of the wrappers and size of the editor
                const calculatedHeight = window.innerHeight - tabPaneContentNodeRect.top - 53;
                desiredHeight = calculatedHeight < defaultEditorHeight ? defaultEditorHeight : calculatedHeight;
            }

            if (this.state.editorHeight != desiredHeight) {
                this.setState({
                    editorHeight: desiredHeight
                });
            }
        }
    }

    componentDidMount() {
        this.getFormValuesFromEntity(this.props.entity);
        this.resizeTabPaneContent();
    }

    componentDidUpdate() {
        this.resizeTabPaneContent();
    }

    localValidateFormValues(state) {
        const templateType = state.getIn(['type', 'value']);
        this.templateTypes[templateType].validate(state);
    }

    submitFormValuesMutator(data) {
        this.templateTypes[data.type].dataOut(data);
        return filterData(data, [
            'name',
            'description',
            'type',
            'settings',
            'elevated_access',
            'namespace'
        ]);
    }

    async save() {
        const t = this.props.t;

        const prevState = this.state.saveState;

        this.setState({
            saveState: SaveState.SAVING
        });

        this.disableForm();

        const submitSuccessful = await this.validateAndSendFormValuesToURL(FormSendMethod.PUT, `rest/templates/${this.props.entity.id}`);

        if (submitSuccessful) {
            await this.getFormValuesFromURL(`rest/templates/${this.props.entity.id}`);
            this.enableForm();
            this.setState({
                saveState: SaveState.SAVED,
                templateVersionId: this.state.templateVersionId + 1
            });
            this.clearFormStatusMessage();
            this.hideFormValidation();
        } else {
            this.enableForm();
            this.setState({
                saveState: prevState
            });

            this.setFormStatusMessage('warning', t('There are errors in the input. Please fix them and submit again.'));
        }
    }

    selectTab(tab) {
        this.setState({
            activeTab: tab
        });
    }

    render() {
        const t = this.props.t;

        const statusMessageText = this.getFormStatusMessageText();
        const statusMessageSeverity = this.getFormStatusMessageSeverity();

        let activeTabContent;
        const tabs = [];

        const templateType = this.getFormValue('type');
        if (templateType) {
            for (const tabSpec of this.templateTypes[templateType].tabs) {
                const isActive = (!this.state.activeTab && tabSpec.default) || this.state.activeTab === tabSpec.id;

                tabs.push(
                    <li key={tabSpec.id} className={isActive ? 'active' : ''}>
                        <ActionLink className={'nav-link' + (isActive ? ' active' : '')}
                                    onClickAsync={async () => this.selectTab(tabSpec.id)}>{tabSpec.label}</ActionLink>
                    </li>
                );

                if (isActive) {
                    activeTabContent = tabSpec.getContent();
                }
            }
        }

        const errors = [];
        for (const [key, entry] of this.state.formState.get('data').entries()) {
            const err = entry.get('error');
            if (err) {
                errors.push(<div key={key}>{err}</div>);
            }
        }

        return (
            <Panel title={t('Edit Template Code')}>
                <div
                    className={developStyles.develop + ' ' + (this.state.isMaximized ? developStyles.fullscreenOverlay : '') + ' ' + (this.state.withPreview ? developStyles.withPreview : '')}>
                    <div className={developStyles.codePane}>
                        <Form stateOwner={this} onSubmitAsync={::this.save} format="wide" noStatus>
                            <div className={developStyles.tabPane}>
                                <div className={developStyles.tabPaneHeader}>
                                    <div className={developStyles.buttons}>
                                        <Button type="submit" className="btn-primary"
                                                label={this.saveLabels[this.state.saveState]}/>
                                        <Button className="btn-primary" icon="window-maximize"
                                                onClickAsync={async () => {
                                                    const newIsMaximized = !this.state.isMaximized;
                                                    this.props.setPanelInFullScreen(newIsMaximized);
                                                    this.setState({isMaximized: newIsMaximized});
                                                }}/>
                                        <Button className="btn-primary"
                                                icon={this.state.withPreview ? 'arrow-right' : 'arrow-left'}
                                                onClickAsync={async () => this.setState({withPreview: !this.state.withPreview})}/>
                                    </div>
                                    <ul className="nav nav-pills">
                                        {tabs}
                                    </ul>
                                </div>

                                <div className={developStyles.formStatus}>
                                    {statusMessageText &&
                                    <div id="form-status-message"
                                         className={`alert alert-${statusMessageSeverity}`}
                                         role="alert">{statusMessageText}</div>
                                    }
                                    {errors.length > 0 && this.isFormValidationShown() &&
                                    <div id="form-status-message"
                                         className={`alert alert-danger`}
                                         role="alert">
                                        {errors}
                                    </div>
                                    }
                                </div>

                                <div ref={node => this.tabPaneContentNode = node}
                                     className={developStyles.tabPaneContent}>
                                    {activeTabContent}
                                </div>
                            </div>
                        </Form>
                    </div>
                    <div className={developStyles.previewPane}>
                        <Preview templateId={this.props.entity.id} templateHash={this.state.templateVersionId}/>
                    </div>
                </div>
            </Panel>
        );
    }
}
