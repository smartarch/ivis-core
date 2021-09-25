'use strict';

import React, {Component} from "react";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    LinkButton,
    requiresAuthenticatedUser,
    Toolbar,
    withPageHelpers
} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import {
    withErrorHandling
} from "../../lib/error-handling";
import {
    tableRestActionDialogRender,
    tableRestActionDialogInit,
    tableAddDeleteButton
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

/**
 *
 */
@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class PresetList extends Component {

    constructor(props) {
        super(props);

        this.state = {};
        tableRestActionDialogInit(this);
    }

    render() {
        const serviceId = this.props.serviceId;
        const t = this.props.t;

        const columns = [
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
        ];

        columns.push({
            actions: data => {
                const actions = [];
                if(data[0] === 1) // so that there will be no button to delete or edit the local preset
                    return actions;

                actions.push({
                    label: <Icon icon="edit" title={t('Edit')}/>,
                    link: `/settings/cloud/${data[1]}/preset/${data[0]}/edit`
                });


                tableAddDeleteButton(actions, this, null, `rest/cloud/${data[1]}/preset/${data[0]}`, data[2], t('Deleting preset ...'), t('Preset deleted'));

                return actions;
            }
        });

        return (
            <Panel title={t('Computation Resource Presets')}>
                {tableRestActionDialogRender(this)}
                <Toolbar>
                    <LinkButton to={`/settings/cloud/${serviceId}/preset/create`} className="btn-primary" icon="plus" label={t('Create Preset')}/>
                </Toolbar>
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/cloud/${serviceId}/presets-table`} columns={columns} />
            </Panel>
        );
    }
};
