'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {TableSelect} from "../../../lib/form";
import {withComponentMixins} from "../../../lib/decorator-helpers";
import {withTranslation} from "../../../lib/i18n";
import axios from "../../../lib/axios";

import {getUrl} from "../../../lib/urls";

/**
 * Form fragment component specialized to handle Azure presets of the location + VM size type
 *
 * These types of components are very service-specific and follow the logic of the preset for which
 * this component acts as a view
 */
@withComponentMixins([
    withTranslation,
])
export default class AzureDefaultFormFramgent extends Component {

    // These constants must be identical to the field names defined in the
    // cloud service's preset type definition { thisPresetType: { fields: [ {name: USE_THIS_CONSTANT}, ... ] } }
    static locationKey = "location";
    static subIdKey = "subscriptionId";
    static vmSizeKey = "vmSize";

    constructor(props) {
        super(props);
        this.state = {
            currentSubId: '',
            currentLocation: '',
            // cached responses (as (particularly location) requests may transfer a lot of data and take > 1s to complete)
            locations: {}, // { someSubscriptionId: [cached response] }
            vmSizes: {}    // { someSubscriptionId: { someLocation:  [cached response] } }
        };
    }

    static propTypes = {
        // needed to act as a "form component"
        formOwner: PropTypes.object.isRequired,
        description: PropTypes.object.isRequired,
        values: PropTypes.object,
        serviceId: PropTypes.number.isRequired
    };

    // the update process of the component follows this logic:
    // subscription is independent of any other preset-specific field
    // available locations depend on the choice of the subscription
    // available VM sizes depend on the choice of the location
    // thus the subscription list is requested ASAP
    componentDidMount() {
        this.mounted = true;
        axios.post(getUrl(`rest/cloud/${this.props.serviceId.toString()}/proxy/${this.getDataSuffix(AzureDefaultFormFramgent.subIdKey)}`))
            .then(response => {
                if (this.mounted) {
                    this.setState({
                        subscriptions: response.data
                    });
                }
            });
    }

    // only when the component is updated do we decide whether to request the other fields' possible values
    // (see above comments)
    componentDidUpdate(prevProps, prevState, snapshot) {
        const formOwner = this.props.formOwner;
        let newSubId = formOwner.getFormValue(AzureDefaultFormFramgent.subIdKey);
        const newLocation = formOwner.getFormValue(AzureDefaultFormFramgent.locationKey);

        if (this.state.currentSubId !== newSubId) {
            // selected subscription has changed
            this.setState({currentSubId: newSubId});
            if (newSubId !== '' && newSubId) {
                this.updateLocations(newSubId);
            } else {
                // reset of the form values
                formOwner.populateFormValues({subscriptionId: '', location: '', vmSize: ''});
                // and do not attempt to update other lists of values
                return;
            }
        }

        if (this.state.currentLocation !== newLocation) {
            // selected location has changed
            this.setState({currentLocation: newLocation}, () => {

                if (newLocation !== '' && newLocation) {
                    this.updateVmSizes(newSubId, newLocation);
                }

                formOwner.populateFormValues({vmSize: this.getCurrentVmSize()});

            });

        }
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    /**
     * @returns {string|*} original VM size if proper location is selected, otherwise an empty string
     */
    getCurrentVmSize() {
        if (this.props.values) {
            if (this.props.values.location === this.state.currentLocation) {
                return this.props.values.vmSize;
            } else {
                return '';
            }
        }
        return '';
    }

    updateLocations(subId) {
        if (this.state.locations[subId])
            return;
        axios.post(getUrl(`rest/cloud/${this.props.serviceId.toString()}/proxy/${this.getDataSuffix(AzureDefaultFormFramgent.locationKey)}`),
            {
                subscriptionId: subId
            })
            .then(response => response.data)
            .then(data => {
                if (this.mounted) {
                    this.setState((prevState) => {
                        // caching received locations
                        let newLocations = {};
                        Object.keys(prevState.locations).forEach(key => newLocations[key] = prevState.locations[key]);
                        newLocations[subId] = data;
                        return {locations: newLocations};
                    });
                }
            });
    }

    updateVmSizes(subId, location) {
        const fetchVms = (subId, location) => {
            if (!this.state.vmSizes[subId][location]) {
                axios.post(getUrl(`rest/cloud/${this.props.serviceId.toString()}/proxy/${this.getDataSuffix(AzureDefaultFormFramgent.vmSizeKey)}`),
                    {
                        subscriptionId: subId,
                        location: location
                    })
                    .then(response => response.data)
                    .then(data => {
                        if (this.mounted) {
                            this.setState((prevState) => {
                                let newSizes = {};
                                Object.assign(newSizes, prevState.vmSizes);
                                newSizes[subId][location] = data;
                                return {vmSizes: newSizes};
                            });
                        }
                    });
            }
        };

        // new location, same logic as in the this.updateLocations method
        if (!this.state.vmSizes[subId]) {
            this.setState(
                prevState => {
                    // creating a new cache entry for VM sizes
                    let newSizes = {};
                    Object.assign(newSizes, prevState.vmSizes);
                    newSizes[subId] = newSizes[subId] ?? [];
                    return {vmSizes: newSizes};
                },
                () => fetchVms(subId, location));
        } else {
            fetchVms(subId, location);
        }

    }

    /**
     * @param id id/name of the field for which data is to be requested
     * @returns {string} part of a url which is to be used to get information
     */
    getDataSuffix(id) {
        let compliant = this.props.description.fields.find(obj => obj.name === id);

        if (!compliant)
            throw new Error(`Field with the id ${id} was not found in the description.`);
        if (!compliant.dataRequest)
            throw new Error(`Field description with the id ${id} does not contain the dataRequest entry. 
            dataRequest entries are required to query data using the cloud service proxy object.`);

        return compliant.dataRequest;
    }

    isFormValueSelected(value) {
        return value && value.length > 0;
    }

    render() {
        const t = this.props.t;
        const subIdColumns = [
            {data: 0, title: t('Name')},
            {data: 1, title: t('Value')}
        ];

        const vmSizeCols = [
            {data: 0, title: t('Name')},
            {data: 1, title: t('Memory (in GB)')},
            {data: 2, title: t('CPU cores')},
            {data: 3, title: t('OS Disk Size (in GB)')}
        ];

        const subId = this.props.formOwner.getFormValue(AzureDefaultFormFramgent.subIdKey);
        const location = this.props.formOwner.getFormValue(AzureDefaultFormFramgent.locationKey);

        const subscriptions = this.state.subscriptions;
        const locations = this.state.locations;
        const vmSizes = this.state.vmSizes;

        return (
            <>
                {
                    // received subscription list?
                    subscriptions ?
                        <TableSelect id={AzureDefaultFormFramgent.subIdKey} label={t('Subscription')} withHeader
                                     dropdown
                                     data={subscriptions} columns={subIdColumns}
                                     selectionLabelIndex={0} selectionKeyIndex={1}/>
                        :
                        <div className="text-center">Fetching Available Subscriptions</div>
                }
                {
                    //if
                    this.isFormValueSelected(subId) ?
                        //if
                        // received location list for currently selected subscription?
                        ((locations && locations[subId]) ?
                            <TableSelect id={AzureDefaultFormFramgent.locationKey} label={t('Location')} withHeader
                                         dropdown
                                         data={locations[subId]} columns={subIdColumns}
                                         selectionLabelIndex={0} selectionKeyIndex={1}/>
                            :
                            //else
                            <div className="text-center">Fetching Available Locations</div>)
                        :
                        //else
                        null
                }
                {
                    // if
                    this.isFormValueSelected(subId) && (locations && locations[subId]) && this.isFormValueSelected(location) ?
                        //if
                        ((vmSizes[subId] && vmSizes[subId][location]) ?
                                <TableSelect id={AzureDefaultFormFramgent.vmSizeKey}
                                             label={t('Virtual Machine Size')} withHeader
                                             dropdown
                                             data={vmSizes[subId][location]} columns={vmSizeCols}
                                             selectionLabelIndex={0} selectionKeyIndex={0}/>
                                :
                                //else
                                <div className="text-center">Fetching VM Sizes</div>
                        )
                        :
                        // else
                        null
                }
            </>
        );
    }
}