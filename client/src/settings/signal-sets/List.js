'use strict';

import React, {Component} from "react";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {LinkButton, requiresAuthenticatedUser, Toolbar, withPageHelpers} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import moment from "moment";
import {IndexingStatus} from "../../../../shared/signals";
import {checkPermissions} from "../../lib/permissions";
import ivisConfig from "ivisConfig";
import em from "../../lib/extension-manager";
import {tableAddDeleteButton, tableRestActionDialogInit, tableRestActionDialogRender,} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {Link} from "react-router-dom";
import {SignalSetType} from "../../../../shared/signal-sets";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableRestActionDialogInit(this);

        const t = props.t;
        this.indexingStates = {
            [IndexingStatus.READY]: t('Ready'),
            [IndexingStatus.REQUIRED]: t('Reindex required'),
            [IndexingStatus.SCHEDULED]: t('Indexing'),
            [IndexingStatus.RUNNING]: t('Indexing')
        }

        if (!em.get('settings.signalSetsAsSensors', false)) {
            this.labels = {
                'Create Signal Set': t('Create Signal Set'),
                'Signal Sets': t('Signal Sets')
            };
        } else {
            this.labels = {
                'Create Signal Set': t('Create Sensor'),
                'Signal Sets': t('Sensors')
            };
        }
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createSignalSet: {
                entityTypeId: 'namespace',
                requiredOperations: ['createSignalSet']
            }
        });

        this.setState({
            createPermitted: result.data.createSignalSet && ivisConfig.globalPermissions.allocateSignalSet
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;
        const labels = this.labels;

        const columns = [
            { data: 1, title: t('Id'), render: data => <code>{data}</code> },
            {
                data: 2,
                title: t('Name'),
                actions: data => {
                    const id = data[0];
                    const label = data[2];
                    const perms = data[10];

                    if (perms.includes('query')) {
                        return [
                            {
                                label,
                                link: `/settings/signal-sets/${id}/records`
                            }
                        ];
                    } else {
                        return [
                            {
                                label
                            }
                        ];
                    }
                }
            },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Type')},
            { data: 5, title: t('Status'), render: data => this.indexingStates[data.indexing.status] },
            {
                data: 9,
                title: t('Last data modification'),
                render: (data, type) => {
                    if (type === "display" && (data === null || moment(data).isBefore(moment('1000-12-31'))))
                        return <i>not available</i>;
                    return moment(data).fromNow();
                }
            },
            { data: 6, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 8, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[10];

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/signal-sets/${data[0]}/edit`
                        });
                    }

                    actions.push({
                        label: <Icon icon="th-list" title={t('Signals')}/>,
                        link: `/settings/signal-sets/${data[0]}/signals`
                    });


                    if (perms.includes('query')) {
                        actions.push({
                            label: <Icon icon="database" title={t('Records')}/>,
                            link: `/settings/signal-sets/${data[0]}/records`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/signal-sets/${data[0]}/share`
                        });
                    }

                    if (data[4] !== SignalSetType.COMPUTED) {
                        tableAddDeleteButton(actions, this, perms, `rest/signal-sets/${data[0]}`, data[2], t('Deleting signal set ...'), t('Signal set deleted'));
                    }
                    return actions;
                }
            }
        ];

        return (
            <Panel title={labels['Signal Sets']}>
                {tableRestActionDialogRender(this)}
                {this.state.createPermitted &&
                <Toolbar>
                    <LinkButton to="/settings/signal-sets/create" className="btn-primary" icon="plus"
                                label={labels['Create Signal Set']}/>
                </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl="rest/signal-sets-table" columns={columns} order={[[5, 'desc']]} />
            </Panel>
        );
    }
}