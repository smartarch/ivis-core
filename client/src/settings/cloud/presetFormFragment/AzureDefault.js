'use strict';

import React, {Component} from "react";
import PropTypes from 'prop-types';
import {
    Button,
    ButtonRow,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    RadioGroup,
    TextArea,
    withForm,
    withFormErrorHandlers
} from "../../../lib/form";
import {withComponentMixins} from "../../../lib/decorator-helpers";
import {withTranslation} from "../../../lib/i18n";
import axios from "../../../lib/axios";

import {getUrl} from "../../../lib/urls";
// TODO: get example (key element: getUrl):
// axios.get(getUrl('rest/cloud/'+this.props.serviceId.toString())).then(response => console.log(response));

/**
 * Form fragment component specialized to handle Azure presets of the location + VM size type
 *
 */
@withComponentMixins([
    withTranslation,
])
export default class AzureDefaultFormFramgent extends Component {

    // These constants must be indentical to the field names defined in the
    // cloud service's preset type definition { thisPresetType: { fields: [ {name: CONSTANT1}, ... ] } }
    static locationKey = "location";
    static vmSizeKey = "vm_size"

    constructor(props) {
        super(props);
        this.state = {
            currentSubId: '',
            locations: {},
            vmSizes: {}
        };
    }

    static propTypes = {
        formOwner: PropTypes.object.isRequired,
        entity: PropTypes.object,
        description: PropTypes.object.isRequired,
        values: PropTypes.object,
        serviceId: PropTypes.number.isRequired
    }

    componentDidMount() {

        axios.post(getUrl(`rest/cloud/${this.props.serviceId.toString()}/proxy/${this.getDataSuffix('subscriptionId')}`))
            .then(response => this.setState({
                subscriptions: response.data
            }));
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        const formOwner = this.props.formOwner;

        const newValue = formOwner.getFormValue("subscriptionId");


        if(this.state.currentSubId !== newValue)
        {
            this.setState({currentSubId: newValue});
            if(newValue !== '' && newValue)
                this.updateLocations(newValue);
        }
    }

    updateLocations(subId) {
        console.log("locationUpdate");
        console.log(this.state.locations[subId]);
        console.log(!this.state.locations[subId]);
        if(!this.state.locations[subId])
        {
            axios.post(getUrl(`rest/cloud/${this.props.serviceId.toString()}/proxy/${this.getDataSuffix('location')}`), {
                subscriptionId: subId
            }).then(response => response.data)
                .then(data => this.setState((prevState) => {
                    let newLocations = {};
                    Object.keys(prevState.locations).forEach(key => newLocations[key] = prevState[key]);
                    newLocations[subId] = data;
                    return {locations: newLocations};
                }));
        }
    }

    updateVmSizes(subId, location) {

    }

    getDataSuffix(id) {
        let compliant = this.props.description.fields.find(obj => obj.name === id);
        if(!compliant)
            throw new Error('Not found or unexpected duplication of IDs!!!');
        return compliant.dataRequest;
    }

    render() {
        const t = this.props.t;
        const subIdColumns = [
            {data: 0, title: t('Name'), orderable: false},
            {data: 1, title: t('Value'), orderable: false}
        ];
        const subId = this.props.formOwner.getFormValue("subscriptionId");
        const locations = this.state.locations;
        console.log(subId);
        console.log(subId.length > 0);
        console.log(locations);
        console.log(locations[subId]);

        return (
            <>
                {
                    this.state.subscriptions ?
                    <TableSelect id="subscriptionId" label={t('Subscription')} withHeader dropdown
                                 data={this.state.subscriptions} columns={subIdColumns}
                                 selectionLabelIndex={0} selectionKeyIndex={1}/> : "Loading"
                }
                {
                    (subId && subId.length > 0) ? ( (locations && locations[subId]) ?
                        <TableSelect id="location" label={t('Location')} withHeader dropdown
                                     data={this.state.locations[subId]} columns={subIdColumns}
                                     selectionLabelIndex={0} selectionKeyIndex={1}/> : "Loading") : <div></div>
                }

                {this.props.description.fields.map(fieldDesc => <InputField key={fieldDesc.name} id={fieldDesc.name} label={t(fieldDesc.label)} type={fieldDesc.type}/>)}
                {/*    this.state.subs &&  <RadioGroup id="subscriptionId1" label={"Subscription"} options={this.state.subs}/>*/}
            </>
            );
    }
}