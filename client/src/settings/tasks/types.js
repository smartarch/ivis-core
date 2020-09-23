'use strict';
import {TaskType, PythonSubtypes} from "../../../../shared/tasks";

const taskSubtypeLabels = {
    [TaskType.PYTHON]: {
        [PythonSubtypes.ENERGY_PLUS]: 'EnergyPlus task',
        [PythonSubtypes.NUMPY]: 'Numpy task',
        [PythonSubtypes.D_VALUE_ESTIMATION]: 'D-Value Estimation'
    }
};

export function getSubtypeLabel(t, type, subtype) {
    let label = t(subtype);

    if (taskSubtypeLabels[type]) {
        if (taskSubtypeLabels[type][subtype]) {
            label = t(taskSubtypeLabels[type][subtype]);
        }
    }

    return label;
}