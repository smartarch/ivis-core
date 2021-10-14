'use strict';

import React, { Component } from "react";
import { tableAddDeleteButton, tableRestActionDialogInit, tableRestActionDialogRender } from "../../lib/modals";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import { Panel } from "../../lib/panel";
import { Table } from "../../lib/table";
import {Toolbar, LinkButton, requiresAuthenticatedUser, DropdownLink} from "../../lib/page";
import {ButtonDropdown} from "../../lib/bootstrap-components";
import {PredictionTypes} from "../../../../shared/predictions";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    requiresAuthenticatedUser
])
export default class PredictionsList extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        tableRestActionDialogInit(this);
    }

    render() {
        const t = this.props.t;
        const sigSetId = this.props.signalSet.id;
        const columns = [
            { data: 0, title: t('id'), render: data => `${data}` },
            {
                data: 2, title: t('Name'),
                actions: data => {
                    const modelId = data[0];
                    const sigSetId = data[1];
                    const label = data[2]; // Model name
                    const type = data[3]; // Model type

                    return [
                        {
                            label,
                            link: `/settings/signal-sets/${sigSetId}/predictions/${type}/${modelId}`
                        }
                    ];
                }
            },
            { data: 3, title: t('Type'), render: data => `${data}` },
            {
                actions: data => {
                    const actions = [];
                    const perms = null;
                    tableAddDeleteButton(actions, this, perms, `rest/signal-sets/${data[1]}/predictions/${data[0]}`, data[2], t('Deleting prediction model ...', t('Prediction model deleted')));

                    return actions;
                }
            }
        ]

        const addModelDropdowns = []
        if (this.props.availablePredictions.hasOwnProperty(PredictionTypes.ARIMA))
            addModelDropdowns.push(<DropdownLink key={PredictionTypes.ARIMA}
                to={`/settings/signal-sets/${sigSetId}/predictions/arima/create`}>{t('ARIMA')}</DropdownLink>)
        if (this.props.availablePredictions.hasOwnProperty(PredictionTypes.NN))
            addModelDropdowns.push(<DropdownLink key={PredictionTypes.NN}
                to={`/settings/signal-sets/${sigSetId}/predictions/neural_network/create`}>{t('Neural network')}</DropdownLink>)
        if (addModelDropdowns.length === 0)
            addModelDropdowns.push(<div className={"dropdown-item text-muted"}>No prediction models available. Enable them in the IVIS server config.</div>)

        return (
            <Panel title={t('Predictions')}>
                {tableRestActionDialogRender(this)}
                <Toolbar>
                    <LinkButton
                        to={`/settings/signal-sets/${sigSetId}/predictions/compare`}
                        className="btn-primary"
                        label={t('Compare models')} />
                    <ButtonDropdown id={"add_model"} label={t('Add model')} buttonClassName={"btn-primary"} menuClassName={"dropdown-menu-right"} icon={"plus"}>
                        {addModelDropdowns}
                    </ButtonDropdown>
                </Toolbar>

                <Table ref={node => this.table = node}
                    withHeader
                    dataUrl={`rest/signal-set-predictions-table/${sigSetId}`}
                    columns={columns} />
            </Panel>
        )
    }
}