'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
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
import moment from "moment";
import {getRunStatuses} from "./states";
import {
    tableAddDeleteButton,
    tableRestActionDialogInit,
   tableRestActionDialogRender
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "react-i18next";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class OwnedSignalSets extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableRestActionDialogInit(this);

        this.runStatuses = getRunStatuses(props.t);
    }

    render() {
        const t = this.props.t;
        const job = this.props.entity;

        const columns = [
            {data: 1, title: t('Name')},
            {data: 2, title: t('Description')},
            {
                actions: data => {

                    const actions = [];
                    const perms = data[3];

                    actions.push({
                        label: <Icon icon="file-alt" family="far" title={t('View signal set')}/>,
                        link: `/settings/signal-sets/${data[0]}/signals`
                    });

                    return {undefined, actions};
                }
            }
        ];


        return (
            <Panel title={t('Signal sets owned by job with id ') + job.id}>
                {tableRestActionDialogRender(this)}
                <Table ref={node => this.table = node} withHeader dataUrl={"rest/owned-signal-sets-table/" + job.id}
                       columns={columns}/>
            </Panel>
        );
    }
}
