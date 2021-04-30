'use strict';
import {TaskType, subtypesByType} from "../../../../shared/tasks";

const WizardType = {
    BLANK: 'blank',
    BASIC: 'basic',
    ENERGY_PLUS: 'energy_plus',
    MOVING_AVERAGE: 'moving_average',
    AGGREGATION: 'aggregation',
    MODEL_COMPARISON: 'model_comparison'
};

// BLANK
const blank = {
    label: 'Blank',
};

const apiShowcase = {
    label: 'Api Showcase'
};

// ENERGY_PLUS
const energyPlus = {
    label: 'Energy plus example'
};


// MOVING_AVERAGE
const movingAvarage = {
    label: 'Moving average example',
};

// AGGREGATION
const aggregation = {
    label: 'Aggregation example',
};

// MODEL COMPARISON
const modelComparison = {
    label: 'Model comparison example',
};

const wizardSpecs = {};

const defaultPythonWizards = {
    [WizardType.BLANK]: blank,
    [WizardType.BASIC]: apiShowcase,
    [WizardType.MOVING_AVERAGE]: movingAvarage,
    [WizardType.AGGREGATION]: aggregation
};

const numpyWizardSpecs = {
    wizards: {
        ...defaultPythonWizards,
        [WizardType.MODEL_COMPARISON]: modelComparison
    }
};

const energyPlusWizardSpecs = {
    wizards: {
        ...defaultPythonWizards,
        [WizardType.ENERGY_PLUS]: energyPlus
    }
};

wizardSpecs[TaskType.PYTHON] = {
    wizards: defaultPythonWizards,
    subtypes: {
        [subtypesByType[TaskType.PYTHON].ENERGY_PLUS]: numpyWizardSpecs,
        [subtypesByType[TaskType.PYTHON].NUMPY]: energyPlusWizardSpecs,

    }
};

function getWizardsForType(taskType, subtype = null) {
    const specsForType = wizardSpecs[taskType];

    if (!specsForType) {
        return null;
    }

    if (subtype) {
        if (!specsForType.subtypes) {
            return null;
        }

        return specsForType.subtypes[subtype] ? specsForType.subtypes[subtype].wizards : null;
    } else {
        return specsForType.wizards;
    }
}

function getWizard(taskType, subtype, wizardType) {
    const wizardsForType = getWizardsForType(taskType, subtype);
    return wizardsForType ? wizardsForType[wizardType] : null;
}

export {
    WizardType,
    getWizard,
    getWizardsForType
};
