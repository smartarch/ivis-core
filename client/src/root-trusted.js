'use strict';

import './lib/public-path';

import em from './lib/extension-manager';
import emCommonDefaults from '../../shared/em-common-defaults';

import React from 'react';
import ReactDOM from 'react-dom';

import {Section} from './lib/page';
import Account from './account/Account';
import Login, {LoginContainer} from './login/Login';
import Reset from './login/Forgot';
import ResetLink from './login/Reset';
import API from './account/API';

import Share from './shares/Share'

import UsersList from './settings/users/List';
import UsersCUD from './settings/users/CUD';
import UserShares from './shares/UserShares';

import NamespacesList from './settings/namespaces/List';
import NamespacesCUD from './settings/namespaces/CUD';

import TemplatesList from './settings/templates/List';
import TemplatesCUD from './settings/templates/CUD';
import TemplatesDevelop from './settings/templates/Develop';
import TemplatesOutput from './settings/templates/Output';

import JobsList from './settings/jobs/List'
import RunningJobsList from './settings/jobs/RunningJobsList'
import JobsCUD from './settings/jobs/CUD';
import RunLog from './settings/jobs/RunLog';
import OwnedSetsList from './settings/jobs/OwnedSignalSets';
import RunOutput from './settings/jobs/RunOutput';

import TasksList from './settings/tasks/List'
import TasksCUD from './settings/tasks/CUD';
import TasksDevelop from './settings/tasks/Develop';
import TasksOutput from './settings/tasks/Output';

import WorkspacesList from './settings/workspaces/List';
import WorkspacesCUD from './settings/workspaces/CUD';

import AlertsList from './settings/alerts/List';
import AlertsCUD from './settings/alerts/CUD';
import AlertsLog from './settings/alerts/Log';

import PanelsList from './settings/workspaces/panels/List';
import PanelsCUD from './settings/workspaces/panels/CUD';

import SignalSetsList from './settings/signal-sets/List';
import SignalSetsCUD from './settings/signal-sets/CUD';
import SignalSetAggregations from './settings/signal-sets/Aggregations';
import AggregationsCUD from './settings/signal-sets/AggregationsCUD';
import RecordsList from './settings/signal-sets/RecordsList';
import RecordsCUD from './settings/signal-sets/RecordsCUD';

import SignalsList from './settings/signal-sets/signals/List';
import SignalsCUD from './settings/signal-sets/signals/CUD';

import SettingsSidebar from './settings/Sidebar';

import SamplePanel from './workspaces/SamplePanel';
import SamplePanel2 from './workspaces/SamplePanel2';

import MainMenuAuthenticated from './MainMenuAuthenticated';
import MainMenuAnonymous from './MainMenuAnonymous';

import WorkspacesOverview from './workspaces/Overview';
import WorkspacesPanelsOverview from './workspaces/panels/Overview';
import WorkspacePanel from './workspaces/panels/WorkspacePanel';

import WorkspaceSidebar from './workspaces/Sidebar';

import GlobalSettings from './settings/global/Update';

import ivisConfig from "ivisConfig";


import {TranslationRoot} from "./lib/i18n";

import {SignalSetKind} from "../../shared/signal-sets";
import {TaskSource, isBuiltinSource} from "../../shared/tasks";

emCommonDefaults.setDefaults(em);

const getStructure = t => {
    let panelStructureSpec = {
        title: resolved => resolved.panel.name,
        link: params => `/workspaces/${params.workspaceId}/${params.panelId}`,
        resolve: {
            panel: params => `rest/panels/${params.panelId}`
        },
        structure: (resolved, params) => {
            if (resolved.panel.template) {
                return {
                    panelRender: props => <WorkspacePanel panel={resolved.panel}/>
                }
            } else {
                const panelStructure = em.get('client.builtinTemplates.routes.' + resolved.panel.builtin_template);
                return panelStructure(resolved.panel, t, `/workspaces/${params.workspaceId}/${params.panelId}`);
            }
        }
    };

    function getSignalChildren() {
        return{
            ':signalId': {
            title: resolved => t('Signal "{{name}}"', {name: resolved.signal.name || resolved.signal.cid}),
                resolve: {
                signal: params => `rest/signals/${params.signalId}`
            },
            link: params => `/settings/signal-sets/${params.signalSetId}/signals/${params.signalId}/edit`,
                navs: {
                'edit': {
                    title: t('Edit'),
                        link: params => `/settings/signal-sets/${params.signalSetId}/signals/${params.signalId}/edit`,
                        visible: resolved => resolved.signal.permissions.includes('edit'),
                        panelRender: props => <SignalsCUD
                        action='edit'
                        signalSet={props.resolved.signalSet}
                        entity={props.resolved.signal}/>
                },
                    'delete': {
                        title: t('Edit'),
                        link: params => `/settings/signal-sets/${params.signalSetId}/signals/${params.signalId}/edit`,
                        visible: resolved => resolved.signal.permissions.includes('edit'),
                        panelRender: props => <SignalsCUD
                            action='delete'
                            signalSet={props.resolved.signalSet}
                            entity={props.resolved.signal}/>
                    },
                share: {
                    title: t('Share'),
                        link: params => `/settings/signal-sets/${params.signalSetId}/signals/${params.signalId}/share`,
                        visible: resolved => resolved.signal.permissions.includes('share'),
                        panelRender: props => <Share title={t('Share')}
                                                     entity={props.resolved.signal}
                                                     entityTypeId="signal"/>
                }
            }
        },
            create: {
                title: t('Create'),
                    panelRender: props => <SignalsCUD signalSet={props.resolved.signalSet}
                                                      action="create"/>
            }
        }
    }

    const structure = {
        title: t('Home'),
        link: () => ivisConfig.isAuthenticated ? '/workspaces' : '/login',
        children: {
            login: {
                title: t('Sign in'),
                link: '/login',
                panelComponent: LoginContainer,
                primaryMenuComponent: MainMenuAnonymous,
                children: {
                    forgot: {
                        title: t('Password reset'),
                        extraParams: [':username?'],
                        link: '/login/forgot',
                        panelComponent: Reset
                    },
                    reset: {
                        title: t('Password reset'),
                        extraParams: [':username', ':resetToken'],
                        link: '/login/reset',
                        panelComponent: ResetLink
                    }
                }
            },
            account: {
                title: t('Account'),
                link: '/account/edit',
                resolve: {
                    workspacesVisible: params => `rest/workspaces-visible`
                },
                primaryMenuComponent: MainMenuAuthenticated,
                navs: {
                    edit: {
                        title: t('Account'),
                        resolve: {
                            user: params => `rest/account`
                        },
                        link: '/account/edit',
                        panelRender: props => (<Account entity={props.resolved.user}/>)
                    },
                    api: {
                        title: t('API'),
                        link: '/account/api',
                        panelComponent: API
                    }
                }
            },
            workspaces: {
                title: t('Workspaces'),
                link: '/workspaces',
                panelComponent: WorkspacesOverview,
                resolve: {
                    workspacesVisible: params => `rest/workspaces-visible`
                },
                primaryMenuComponent: MainMenuAuthenticated,
                secondaryMenuComponent: WorkspaceSidebar,
                children: {
                    ':workspaceId': {
                        title: resolved => resolved.workspace.name,
                        resolve: {
                            workspace: params => `rest/workspaces/${params.workspaceId}`,
                            panelsVisible: params => `rest/panels-visible/${params.workspaceId}`
                        },
                        link: params => `/workspaces/${params.workspaceId}`,
                        panelRender: props => <WorkspacesPanelsOverview workspace={props.resolved.workspace}/>,
                        children: {
                            ':panelId': {
                                ...panelStructureSpec,
                                children: {
                                    'fullscreen': {
                                        ...panelStructureSpec,
                                        panelInFullScreen: true,
                                        link: params => `/workspaces/${params.workspaceId}/${params.panelId}/fullscreen`,
                                    }
                                }
                            }
                        }
                    },

                    sample: {
                        title: t('Sample workspace'),
                        link: '/workspaces/sample',
                        panelComponent: SamplePanel,
                    },

                    sample2: {
                        title: t('Sample workspace 2'),
                        link: '/workspaces/sample2',
                        panelComponent: SamplePanel2,
                    },
                }
            },
            "fullscreen-panel": {
                children: {
                    sample2: {
                        title: t('Sample workspace 2'),
                        link: '/workspaces/sample2',
                        panelComponent: SamplePanel2,
                        panelInFullScreen: true
                    }
                }
            },
            settings: {
                title: t('Administration'),
                resolve: {
                    workspacesVisible: params => `rest/workspaces-visible`
                },
                link: '/settings/workspaces',
                primaryMenuComponent: MainMenuAuthenticated,
                secondaryMenuComponent: SettingsSidebar,
                children: {
                    global: {
                        title: t('Global Settings'),
                        link: '/settings/global',
                        resolve: {
                            configItems: params => `rest/settings`
                        },
                        panelRender: props => <GlobalSettings entity={props.resolved.configItems}/>
                    },
                    workspaces: {
                        title: t('Workspaces'),
                        link: '/settings/workspaces',
                        panelComponent: WorkspacesList,
                        children: {
                            ':workspaceId': {
                                title: resolved => t('Workspace "{{name}}"', {name: resolved.workspace.name}),
                                resolve: {
                                    workspace: params => `rest/workspaces/${params.workspaceId}`
                                },
                                link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                navs: {
                                    /*':action(edit|delete)': {
                                        title: t('Edit'),
                                        link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                        visible: resolved => resolved.workspace.permissions.includes('edit'),
                                        panelRender: props => <WorkspacesCUD action={props.match.params.action}
                                                                             entity={props.resolved.workspace}
                                                                             workspacesVisible={props.resolved.workspacesVisible}/>
                                    },*/
                                    edit: {
                                        title: t('Edit'),
                                        link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                        visible: resolved => resolved.workspace.permissions.includes('edit'),
                                        panelRender: props => <WorkspacesCUD action="edit"
                                                                             entity={props.resolved.workspace}
                                                                             workspacesVisible={props.resolved.workspacesVisible}/>
                                    },
                                    'delete': {
                                        title: t('Delete'),
                                        link: params => `/settings/workspaces/${params.workspaceId}/delete`,
                                        visible: resolved => resolved.workspace.permissions.includes('delete'),
                                        panelRender: props => <WorkspacesCUD action="delete"
                                                                             entity={props.resolved.workspace}
                                                                             workspacesVisible={props.resolved.workspacesVisible}/>
                                    },
                                    panels: {
                                        title: t('Panels'),
                                        link: params => `/settings/workspaces/${params.workspaceId}/panels`,
                                        panelRender: props => <PanelsList workspace={props.resolved.workspace}/>,
                                        children: {
                                            ':panelId': {
                                                title: resolved => t('Panel "{{name}}"', {name: resolved.panel.name}),
                                                resolve: {
                                                    panel: params => `rest/panels/${params.panelId}`
                                                },
                                                link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/edit`,
                                                navs: {
                                                    'edit': {
                                                        title: t('Edit'),
                                                        resolve: {
                                                            panelsVisible: params => `rest/panels-visible/${params.workspaceId}`
                                                        },
                                                        link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/edit`,
                                                        visible: resolved => resolved.panel.permissions.includes('edit'),
                                                        panelRender: props => <PanelsCUD
                                                            action='edit'
                                                            entity={props.resolved.panel}
                                                            workspace={props.resolved.workspace}
                                                            panelsVisible={props.resolved.panelsVisible}/>
                                                    },
                                                    ':delete': {
                                                        title: t('Edit'),
                                                        resolve: {
                                                            panelsVisible: params => `rest/panels-visible/${params.workspaceId}`
                                                        },
                                                        link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/edit`,
                                                        visible: resolved => resolved.panel.permissions.includes('edit'),
                                                        panelRender: props => <PanelsCUD
                                                            action='delete'
                                                            entity={props.resolved.panel}
                                                            workspace={props.resolved.workspace}
                                                            panelsVisible={props.resolved.panelsVisible}/>
                                                    },
                                                    share: {
                                                        title: t('Share'),
                                                        link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/share`,
                                                        visible: resolved => resolved.panel.permissions.includes('share'),
                                                        panelRender: props => <Share title={t('Share')}
                                                                                     entity={props.resolved.panel}
                                                                                     entityTypeId="panel"/>
                                                    }
                                                }
                                            },
                                            create: {
                                                title: t('Create'),
                                                resolve: {
                                                    panelsVisible: params => `rest/panels-visible/${params.workspaceId}`
                                                },
                                                panelRender: props => <PanelsCUD action="create"
                                                                                 workspace={props.resolved.workspace}
                                                                                 panelsVisible={props.resolved.panelsVisible}/>
                                            },

                                        }
                                    },
                                    share: {
                                        title: t('Share'),
                                        link: params => `/settings/workspaces/${params.workspaceId}/share`,
                                        visible: resolved => resolved.workspace.permissions.includes('share'),
                                        panelRender: props => <Share title={t('Share')}
                                                                     entity={props.resolved.workspace}
                                                                     entityTypeId="workspace"/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create'),
                                panelRender: props => <WorkspacesCUD action="create"
                                                                     workspacesVisible={props.resolved.workspacesVisible}/>
                            }
                        }
                    },
                    alerts: {
                        title: t('Alerts'),
                        link: '/settings/alerts',
                        panelComponent: AlertsList,
                        children: {
                            ':alertId': {
                                title: resolved => t('Alert "{{name}}"', {name: resolved.alert.name}),
                                resolve: {
                                    alert: params => `rest/alerts/${params.alertId}`
                                },
                                link: params => `/settings/alerts/${params.alertId}/edit`,
                                navs: {
                                    'edit': {
                                        title: t('Settings'),
                                        link: params => `/settings/alerts/${params.alertId}/edit`,
                                        visible: resolved => resolved.alert.permissions.includes('edit'),
                                        panelRender: props => <AlertsCUD action='edit'
                                                                         entity={props.resolved.alert}/>
                                    },
                                    'delete': {
                                        title: t('Settings'),
                                        link: params => `/settings/alerts/${params.alertId}/edit`,
                                        visible: resolved => resolved.alert.permissions.includes('edit'),
                                        panelRender: props => <AlertsCUD action='delete'
                                                                         entity={props.resolved.alert}/>
                                    },
                                    log: {
                                        title: t('Log'),
                                        link: params => `/settings/alerts/${params.alertId}/log`,
                                        visible: resolved => resolved.alert.permissions.includes('view'),
                                        panelRender: props => <AlertsLog alertId={props.resolved.alert.id}/>
                                    },
                                    share: {
                                        title: t('Share'),
                                        link: params => `/settings/alerts/${params.alertId}/share`,
                                        visible: resolved => resolved.alert.permissions.includes('share'),
                                        panelRender: props => <Share title={t('Share')} entity={props.resolved.alert}
                                                                     entityTypeId="alert"/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create'),
                                panelRender: props => <AlertsCUD action="create"/>
                            }
                        }
                    },
                    templates: {
                        title: t('Templates'),
                        link: '/settings/templates',
                        panelComponent: TemplatesList,
                        children: {
                            ':templateId': {
                                title: resolved => t('Template "{{name}}"', {name: resolved.template.name}),
                                resolve: {
                                    template: params => `rest/templates/${params.templateId}`
                                },
                                link: params => `/settings/templates/${params.templateId}/edit`,
                                navs: {
                                    develop: {
                                        title: t('Code'),
                                        link: params => `/settings/templates/${params.templateId}/develop`,
                                        visible: resolved => resolved.template.permissions.includes('edit'),
                                        panelRender: props => <TemplatesDevelop entity={props.resolved.template}
                                                                                setPanelInFullScreen={props.setPanelInFullScreen}/>
                                    },
                                    output: {
                                        title: t('Output'),
                                        link: params => `/settings/templates/${params.templateId}/output`,
                                        visible: resolved => resolved.template.permissions.includes('edit'),
                                        panelRender: props => <TemplatesOutput entity={props.resolved.template}/>
                                    },
                                    edit: {
                                        title: t('Settings - edit'),
                                        link: params => `/settings/templates/${params.templateId}/edit`,
                                        visible: resolved => resolved.template.permissions.includes('edit'),
                                        panelRender: props => <TemplatesCUD action="edit"
                                                                            entity={props.resolved.template}/>
                                    },
                                    'delete': {
                                        title: t('Settings'),
                                        link: params => `/settings/templates/${params.templateId}/edit`,
                                        visible: resolved => resolved.template.permissions.includes('edit'),
                                        panelRender: props => <TemplatesCUD action="delete"
                                                                            entity={props.resolved.template}/>
                                    },
                                    share: {
                                        title: t('Share'),
                                        link: params => `/settings/templates/${params.templateId}/share`,
                                        visible: resolved => resolved.template.permissions.includes('share'),
                                        panelRender: props => <Share title={t('Share')} entity={props.resolved.template}
                                                                     entityTypeId="template"/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create'),
                                panelRender: props => <TemplatesCUD action="create"/>
                            }
                        }
                    },
                    tasks: {
                        title: t('Tasks'),
                        link: '/settings/tasks',
                        panelComponent: TasksList,
                        children: {
                            ':taskId': {
                                title: resolved => t('Task "{{name}}"', {name: resolved.task.name}),
                                resolve: {
                                    task: params => `rest/tasks/${params.taskId}`
                                },
                                link: params => `/settings/tasks/${params.taskId}/edit`,
                                navs: {
                                    develop: {
                                        title: t('Code'),
                                        link: params => `/settings/tasks/${params.taskId}/develop`,
                                        visible: resolved => isBuiltinSource(resolved.task.source) || resolved.task.permissions.includes('edit'),
                                        panelRender: props => <TasksDevelop entity={props.resolved.task}/>
                                    },
                                    output: {
                                        title: t('Output'),
                                        link: params => `/settings/tasks/${params.taskId}/output`,
                                        visible: resolved => isBuiltinSource(resolved.task.source) || resolved.task.permissions.includes('edit'),
                                        panelRender: props => <TasksOutput entity={props.resolved.task}/>
                                    },
                                    'edit': {
                                        title: t('Settings'),
                                        link: params => `/settings/tasks/${params.taskId}/edit`,
                                        visible: resolved => resolved.task.permissions.includes('edit'),
                                        panelRender: props => <TasksCUD action='edit'
                                                                        entity={props.resolved.task}/>
                                    },
                                    'delete': {
                                        title: t('Settings'),
                                        link: params => `/settings/tasks/${params.taskId}/edit`,
                                        visible: resolved => resolved.task.permissions.includes('edit'),
                                        panelRender: props => <TasksCUD action='delete'
                                                                        entity={props.resolved.task}/>
                                    },


                                    share: {
                                        title: t('Share'),
                                        link: params => `/settings/tasks/${params.taskId}/share`,
                                        visible: resolved => resolved.task.permissions.includes('share'),
                                        panelRender: props => <Share title={t('Share')} entity={props.resolved.task}
                                                                     entityTypeId="task"/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create'),
                                panelRender: props => <TasksCUD action="create"/>
                            }
                        }
                    },
                    jobs: {
                        title: t('Jobs'),
                        link: '/settings/jobs',
                        // TODO check this belongs here
                        navs: {
                            running: {
                                title: t('Running jobs'),
                                link: `/settings/jobs/running`,
                                panelRender: props => <RunningJobsList/>
                            }
                        },
                        panelComponent: JobsList,
                        children: {
                            ':jobId': {
                                title: resolved => t('Job "{{name}}"', {name: resolved.job.name}),
                                resolve: {
                                    job: params => `rest/jobs/${params.jobId}`
                                },
                                link: params => `/settings/jobs/${params.jobId}/edit`,
                                navs: {
                                    'edit': {
                                        title: t('Settings'),
                                        link: params => `/settings/jobs/${params.jobId}/edit`,
                                        visible: resolved => resolved.job.permissions.includes('edit'),
                                        panelRender: props => <JobsCUD action='edit'
                                                                       entity={props.resolved.job}/>
                                    },
                                    'delete': {
                                        title: t('Settings'),
                                        link: params => `/settings/jobs/${params.jobId}/edit`,
                                        visible: resolved => resolved.job.permissions.includes('edit'),
                                        panelRender: props => <JobsCUD action='delete'
                                                                       entity={props.resolved.job}/>
                                    },
                                    'signal-sets': {
                                        title: t('Owned signal sets'),
                                        link: params => `/settings/jobs/${params.jobId}/signal-sets`,
                                        visible: resolved => resolved.job.permissions.includes('view'),
                                        panelRender: props => <OwnedSetsList entity={props.resolved.job}/>
                                    },
                                    log: {
                                        title: t('Run logs'),
                                        link: params => `/settings/jobs/${params.jobId}/log`,
                                        visible: resolved => resolved.job.permissions.includes('view'),
                                        panelRender: props => <RunLog entity={props.resolved.job}/>,
                                        children: {
                                            ':runId': {
                                                title: t('View log'),
                                                resolve: {
                                                    run: params => `rest/jobs/${params.jobId}/run/${params.runId}`
                                                },
                                                link: params => `/settings/jobs/${params.jobId}/run/${params.runId}`,
                                                visible: resolved => resolved.job.permissions.includes('view'),
                                                panelRender: props => <RunOutput entity={props.resolved.run}/>
                                            }
                                        }
                                    },
                                    share: {
                                        title: t('Share'),
                                        link: params => `/settings/jobs/${params.jobId}/share`,
                                        visible: resolved => resolved.job.permissions.includes('share'),
                                        panelRender: props => <Share title={t('Share')} entity={props.resolved.job}
                                                                     entityTypeId="job"/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create'),
                                panelRender: props => <JobsCUD action="create"/>
                            }
                        }
                    },
                    'signal-sets': {
                        title: !em.get('settings.signalSetsAsSensors', false) ? t('Signal Sets') : t('Sensors'),
                        link: '/settings/signal-sets',
                        panelComponent: SignalSetsList,
                        children: {
                            ':signalSetId': {
                                title: resolved =>
                                    !em.get('settings.signalSetsAsSensors', false)
                                        ? t('Signal Set "{{name}}"', {name: resolved.signalSet.name || resolved.signalSet.cid})
                                        : t('Sensor "{{name}}"', {name: resolved.signalSet.name || resolved.signalSet.cid}),
                                resolve: {
                                    signalSet: params => `rest/signal-sets/${params.signalSetId}`
                                },
                                link: params => `/settings/signal-sets/${params.signalSetId}/edit`,
                                navs: {
                                    'edit': {
                                        title: t('Edit'),
                                        link: params => `/settings/signal-sets/${params.signalSetId}/edit`,
                                        visible: resolved => resolved.signalSet.permissions.includes('edit'),
                                        panelRender: props => <SignalSetsCUD action='edit'
                                                                             entity={props.resolved.signalSet}/>
                                    },
                                    'delete': {
                                        title: t('Edit'),
                                        link: params => `/settings/signal-sets/${params.signalSetId}/edit`,
                                        visible: resolved => resolved.signalSet.permissions.includes('edit'),
                                        panelRender: props => <SignalSetsCUD action='delete'
                                                                             entity={props.resolved.signalSet}/>
                                    },
                                    'aggregations': {
                                        title: t('Aggregations'),
                                        link: params => `/settings/signal-sets/${params.signalSetId}/aggregations`,
                                        visible: resolved => resolved.signalSet.permissions.includes('view') && resolved.signalSet.kind === SignalSetKind.TIME_SERIES,
                                        panelRender: props => <SignalSetAggregations
                                            signalSet={props.resolved.signalSet}/>,
                                        children: {
                                            ":jobId": {
                                                title: resolved => t('Aggregation "{{name}}"', {name: resolved.job.name}),
                                                resolve: {
                                                    job: params => `rest/jobs/${params.jobId}`
                                                },
                                                link: params => `/settings/signal-sets/${params.signalSetId}/aggregations/${params.jobId}/edit`,
                                                children: {
                                                    'edit': {
                                                        title: t('Edit'),
                                                        link: params => `/settings/signal-sets/${params.signalSetId}/aggregations/${params.jobId}/edit`,
                                                        visible: resolved => resolved.signalSet.permissions.includes('edit'),
                                                        panelRender: props => <AggregationsCUD
                                                            signalSet={props.resolved.signalSet}
                                                            job={props.resolved.job}
                                                            action='edit'/>
                                                    },
                                                    'delete': {
                                                        title: t('Edit'),
                                                        link: params => `/settings/signal-sets/${params.signalSetId}/aggregations/${params.jobId}/edit`,
                                                        visible: resolved => resolved.signalSet.permissions.includes('edit'),
                                                        panelRender: props => <AggregationsCUD
                                                            signalSet={props.resolved.signalSet}
                                                            job={props.resolved.job}
                                                            action='delete'/>
                                                    }
                                                }
                                            },
                                            create: {
                                                title: t('Create'),
                                                panelRender: props => <AggregationsCUD
                                                    signalSet={props.resolved.signalSet} action="create"/>
                                            }
                                        }
                                    },
                                    'signals': {
                                        title: t('Signals'),
                                        link: params => `/settings/signal-sets/${params.signalSetId}/signals`,
                                        panelRender: props => <SignalsList action='signals'
                                                                           signalSet={props.resolved.signalSet}/>,
                                        children: getSignalChildren()
                                    },
                                    'reindex': {
                                        title: t('Signals'),
                                        link: params => `/settings/signal-sets/${params.signalSetId}/signals`,
                                        panelRender: props => <SignalsList action='reindex'
                                                                           signalSet={props.resolved.signalSet}/>,
                                        children: getSignalChildren()
                                    },
                                    'records': {
                                        title: t('Records'),
                                        resolve: {
                                            signalsVisibleForList: params => `rest/signals-visible-list/${params.signalSetId}`
                                        },
                                        link: params => `/settings/signal-sets/${params.signalSetId}/records`,
                                        visible: resolved => resolved.signalSet.permissions.includes('query'),
                                        panelRender: props => <RecordsList signalSet={props.resolved.signalSet}
                                                                           signalsVisibleForList={props.resolved.signalsVisibleForList}/>,
                                        children: {
                                            create: {
                                                title: t('Create'),
                                                resolve: {
                                                    signalsVisibleForEdit: params => `rest/signals-visible-edit/${params.signalSetId}`
                                                },
                                                link: params => `/settings/signal-sets/${params.signalSetId}/records/create`,
                                                panelRender: props => <RecordsCUD action="create"
                                                                                  signalSet={props.resolved.signalSet}
                                                                                  signalsVisibleForEdit={props.resolved.signalsVisibleForEdit}/>
                                            },
                                            ':recordIdBase64/edit': {
                                                title: t('Edit'),
                                                resolve: {
                                                    signalsVisibleForEdit: params => `rest/signals-visible-edit/${params.signalSetId}`,
                                                    record: params => `rest/signal-set-records/${params.signalSetId}/${params.recordIdBase64}`
                                                },
                                                link: params => `/settings/signal-sets/${params.signalSetId}/records/${params.recordIdBase64}/edit`,
                                                panelRender: props => <RecordsCUD action='edit'
                                                                                  signalSet={props.resolved.signalSet}
                                                                                  signalsVisibleForEdit={props.resolved.signalsVisibleForEdit}
                                                                                  record={props.resolved.record}/>
                                            },
                                            ':recordIdBase64/delete': {
                                                title: t('Edit'),
                                                resolve: {
                                                    signalsVisibleForEdit: params => `rest/signals-visible-edit/${params.signalSetId}`,
                                                    record: params => `rest/signal-set-records/${params.signalSetId}/${params.recordIdBase64}`
                                                },
                                                link: params => `/settings/signal-sets/${params.signalSetId}/records/${params.recordIdBase64}/edit`,
                                                panelRender: props => <RecordsCUD action='delete'
                                                                                  signalSet={props.resolved.signalSet}
                                                                                  signalsVisibleForEdit={props.resolved.signalsVisibleForEdit}
                                                                                  record={props.resolved.record}/>
                                            }
                                        }
                                    },
                                    share: {
                                        title: t('Share'),
                                        link: params => `/settings/signal-sets/${params.signalSetId}/share`,
                                        visible: resolved => resolved.signalSet.permissions.includes('share'),
                                        panelRender: props => <Share title={t('Share')}
                                                                     entity={props.resolved.signalSet}
                                                                     entityTypeId="signalSet"/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create'),
                                panelRender: props => <SignalSetsCUD action="create"/>
                            }
                        }
                    },
                    users: {
                        title: t('Users'),
                        link: '/settings/users',
                        panelComponent: UsersList,
                        children: {
                            ':userId': {
                                title: resolved => t('User "{{name}}"', {name: resolved.user.name}),
                                resolve: {
                                    user: params => `rest/users/${params.userId}`
                                },
                                link: params => `/settings/users/${params.userId}/edit`,
                                navs: {
                                    'edit': {
                                        title: t('Edit'),
                                        link: params => `/settings/users/${params.userId}/edit`,
                                        panelRender: props => (
                                            <UsersCUD action='edit' entity={props.resolved.user}/>)
                                    },
                                    'delete': {
                                        title: t('Edit'),
                                        link: params => `/settings/users/${params.userId}/edit`,
                                        panelRender: props => (
                                            <UsersCUD action='delete' entity={props.resolved.user}/>)
                                    },
                                    shares: {
                                        title: t('Shares'),
                                        link: params => `/settings/users/${params.userId}/shares`,
                                        panelRender: props => <UserShares user={props.resolved.user}/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create User'),
                                panelRender: props => (<UsersCUD action="create"/>)
                            }
                        }
                    },
                    namespaces: {
                        title: t('Namespaces'),
                        link: '/settings/namespaces',
                        panelComponent: NamespacesList,
                        children: {
                            ':namespaceId': {
                                title: resolved => t('Namespace "{{name}}"', {name: resolved.namespace.name}),
                                resolve: {
                                    namespace: params => `rest/namespaces/${params.namespaceId}`
                                },
                                link: params => `/settings/namespaces/${params.namespaceId}/edit`,
                                navs: {
                                    'edit': {
                                        title: t('Edit'),
                                        link: params => `/settings/namespaces/${params.namespaceId}/edit`,
                                        visible: resolved => resolved.namespace.permissions.includes('edit'),
                                        panelRender: props => <NamespacesCUD action='edit'
                                                                             entity={props.resolved.namespace}/>
                                    },
                                    'delete': {
                                        title: t('Delete'),
                                        link: params => `/settings/namespaces/${params.namespaceId}/edit`,
                                        visible: resolved => resolved.namespace.permissions.includes('edit'),
                                        panelRender: props => <NamespacesCUD action='delete'
                                                                             entity={props.resolved.namespace}/>
                                    },
                                    share: {
                                        title: t('Share'),
                                        link: params => `/settings/namespaces/${params.namespaceId}/share`,
                                        visible: resolved => resolved.namespace.permissions.includes('share'),
                                        panelRender: props => <Share title={t('Share')}
                                                                     entity={props.resolved.namespace}
                                                                     entityTypeId="namespace"/>
                                    }
                                }
                            },
                            create: {
                                title: t('Create'),
                                panelRender: props => <NamespacesCUD action="create"/>
                            },
                        }
                    }
                }
            }
        }
    };

    em.invoke('client.installRoutes', structure, t);

    return structure;
};

ReactDOM.render(
    <TranslationRoot><Section root='/' structure={getStructure}/></TranslationRoot>,
    document.getElementById('root')
);

