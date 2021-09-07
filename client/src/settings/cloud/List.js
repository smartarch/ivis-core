'use strict';

import React, {Component} from "react";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import {
    withErrorHandling
} from "../../lib/error-handling";
import {
    tableRestActionDialogRender,
    tableRestActionDialogInit
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";


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
    }

    render() {

        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Name') },
        ];

        columns.push({
            actions: data => {
                const actions = [];
                actions.push({
                    label: <Icon icon="edit" title={t('Edit')}/>,
                    link: `/settings/cloud/${data[0]}/edit`
                });

                return actions;
            }
        });

        return (
            <Panel title={t('Cloud Services')}>
                {tableRestActionDialogRender(this)}
                <Table ref={node => this.table = node} withHeader dataUrl="rest/cloud_services-table" columns={columns} />
            </Panel>
        );
    }
};
