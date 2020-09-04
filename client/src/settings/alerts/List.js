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
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import moment
    from "moment";
import {checkPermissions} from "../../lib/permissions";
import {
    tableAddDeleteButton,
    tableRestActionDialogInit,
    tableRestActionDialogRender
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
            { data: 2, title: t('Description') },
            { data: 3, title: t('Enabled')},
            { data: 4, title: t('Created') },
            { data: 5, title: t('Namespace') },
        ];

        return (
            <Panel title={t('Alerts')}>
                {tableRestActionDialogRender(this)}
                    <Toolbar>
                        <LinkButton to="/settings/alerts/create" className="btn-primary" icon="plus" label={t('Create Alert')}/>
                    </Toolbar>
                <Table ref={node => this.table = node} withHeader dataUrl="rest/workspaces-table" columns={columns} />
            </Panel>
        );
    }
}
// based on ../workspaces/List.js
