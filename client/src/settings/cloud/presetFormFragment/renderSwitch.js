'use strict';

import React, {Component} from "react";
import AzureDefaultFormFramgent from './AzureDefault';

export default function RenderSwitch({formOwner, preset_type, presetEntity, descriptions, values, serviceId})
{
    // the case values are PRESET TYPES as defined in the models/cloud_config folder on the server side
    switch (preset_type){
        case 'azureLocationSize':
            return <AzureDefaultFormFramgent formOwner={formOwner} entity={presetEntity} description={descriptions[preset_type]} values={values} serviceId={serviceId}/>;
        default:
            return <div className="text-center">Please select preset type to specialize this preset</div>;
    }
}