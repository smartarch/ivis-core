'use strict';

const knex = require('../lib/knex');
const dtHelpers = require('../lib/dt-helpers');
const { enforce, filterObject } = require('../lib/helpers');
const shares = require('./shares');
const { allowedKeysCreate: allowedSignalSetKeysCreate } = require('../lib/signal-set-helpers');
const { allowedKeysCreate: allowedSignalKeysCreate } = require('../lib/signal-helpers');
const namespaceHelpers = require('../lib/namespace-helpers');
const { SignalSetType, SignalSetKind } = require('../../shared/signal-sets');
const { SignalSource } = require('../../shared/signals');
const createSigSet = require('./signal-sets').createTx;
const createSignal = require('./signals').createTx;
const { PredictionTypes } = require('../../shared/predictions');
const interoperableErrors = require('../../shared/interoperable-errors');
const jobs = require('./jobs');
const removeSigSetById = require('./signal-sets').removeById;
const { arimaCleanupTx } = require('./predictions-arima');
const hasher = require('node-object-hash')();


const allowedKeys = new Set(['name', 'description', 'set', 'type', 'namespace', 'settings', 'ahead_count', 'future_count', 'signals']);
const allowedKeysUpdateWithConsistency = new Set(['description']);


function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdateWithConsistency));
}

/** These type specific function are called during model deletion
 */
const deleteCallbacks = {
    /* signature: async x(tx, context, predictionId )*/
    [PredictionTypes.ARIMA]: arimaCleanupTx
}

/* Prediction signature:
 *
 * prediction = {
 *      id, // assigned by db
 *      set, // id of the source signal set (the one being predicted)
 *      type, // type of the prediction
 *      namespace,
 *      settings, // prediction specific JSON object
 *      ahead_count,
 *      future_count,
 *      signals, // description of the output signals, created by registerPredictionModelTx
 * };
 *
 * signals = {
 *      main: [
 *      ],
 *      // extra signals are optional, can be omitted or []
 *      extra: [
 *      ],
 * };
 *
 */

/** Create an entry for prediction model and create its output signal sets
 *
 */
async function registerPredictionModelTx(tx, context, prediction) {
    const signalSet = await tx('signal_sets').where('id', prediction.set).first();
    enforce(signalSet, `Signal set ${prediction.set} not found`);

    const outSignals = prediction.signals.main;
    const extraSignals = prediction.signals.extra;

    if (!outSignals) {
        throw new Error("A prediction model has to have output signals!");
    }

    // noinspection UnnecessaryLocalVariableJS
    const filteredSignals = {
        'main': outSignals ? outSignals : [],
        'extra': extraSignals ? extraSignals : [],
    };

    prediction.signals = filteredSignals;

    const predId = await _createPredictionTx(tx, context, prediction);
    prediction.id = predId;
    await _createOutputSignalSets(tx, context, prediction, outSignals);
    if (extraSignals) {
        await _createOutputSignalSets(tx, context, prediction, extraSignals);
    }

    return predId;
}

/** Links a job to an existing models in order to:
 *  1. ensure that the job cannot be deleted while the model exists
 *  2. make the job own output signal sets so that it can work with its indices
 *     when it is run
 */
async function registerPredictionModelJobTx(tx, context, modelId, jobId) {
    shares.enforceEntityPermissionTx(tx, context, 'job', jobId, 'edit');
    shares.enforceEntityPermissionTx(tx, context, 'prediction', modelId, 'edit');

    const predJob = {
        prediction: modelId,
        job: jobId
    };

    await tx('predictions_jobs').insert(predJob);
    await _rebuildOuputOwnership(tx, context, modelId);
}

async function update(context, prediction, withConsistencyCheck = false) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'prediction', prediction.id, 'edit');

        const existing = await tx('predictions').where('id', prediction.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        if (withConsistencyCheck) {
            const existingHash = hash(existing);
            if (existingHash !== prediction.originalHash) {
                throw new interoperableErrors.ChangedError();
            }
        }

        const filtered = filterObject(prediction, withConsistencyCheck ? allowedKeysUpdateWithConsistency : allowedKeys);
        if (filtered.hasOwnProperty('signals'))
            filtered.signals = JSON.stringify(filtered.signals);
        if (filtered.hasOwnProperty('settings'))
            filtered.settings = JSON.stringify(filtered.settings);

        await tx('predictions').where('id', prediction.id).update(filtered);

        await shares.rebuildPermissionsTx(tx, {entityTypeId: 'prediction', entityId: prediction.id});
    });
}

/** Return description of output signal sets and signals
 *
 * This object is then used by Python predictions write API
 *
 * structure:
 * outputConfig = {
 *      ahead_sets: {
 *          '1': '1aheadSetCid',
 *          '2': '2aheadSetCid',
 *          ...
 *      },
 *      future_set: 'futureSetCid',
 *      signals: {
 *          'main': [], // main signals (subset of source signal set signals)
 *          'extra': [], // extra signals (those not part of the source sigset)
 *      }
 * };
 */
async function getOutputConfigTx(tx, context, predictionId) {
    await shares.enforceEntityPermissionTx(tx, context, 'prediction', predictionId, 'view');

    const outSignals = JSON.parse((await tx('predictions').where('id', predictionId).first()).signals);

    const predSets = await tx('predictions_signal_sets').where('prediction', predictionId);
    let futureSet = {};
    let aheadSets = {};

    let i = 1;
    for (let ps of predSets) {
        let signalSet = await tx('signal_sets').where('id', ps.set).first();
        if (signalSet.cid.endsWith('future')) {
            futureSet = signalSet.cid;
        } else {
            aheadSets[i] = signalSet.cid;
            i++;
        }
    }

    return {
        ahead_sets: aheadSets,
        future_set: futureSet,
        signals: outSignals
    };
}

async function getOutputConfig(context, predictionId) {
    return await knex.transaction(async tx => {
        return await getOutputConfigTx(tx, context, predictionId);
    });
}

async function listDTAjax(context, sigSetId, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'prediction', requiredOperations: ['view']}],
        params,
        builder => builder
            .from('predictions')
            .where('set', sigSetId),
        //.join('predictions_signal_sets', 'set', '=', 'predictions_signal_sets.id'),
        ['predictions.id', 'predictions.set', 'predictions.name', 'predictions.type', 'predictions.description'],
    );
}

async function removeById(context, setId, predictionId) {
    let jobsToDelete;
    let setsToDelete;

    const val = await knex.transaction(async tx => {
        const existing = await tx('predictions').where('id', predictionId).first();

        if (!existing) {
            shares.throwPermissionDenied();
        }

        await shares.enforceEntityPermissionTx(tx, context, 'prediction', existing.id, 'delete');

        // Type specific delete
        await _deleteTypeSpecificTx(tx, context, predictionId, existing.type);

        // unlink remaining jobs
        jobsToDelete = await tx('predictions_jobs').where('prediction', existing.id);
        for (let job of jobsToDelete) {
            await tx('predictions_jobs').where('prediction', existing.id).where('job', job.job).del();
        }

        setsToDelete = await tx('predictions_signal_sets').where('prediction', existing.id);
        for (let set of setsToDelete) {
            await tx('predictions_signal_sets').where('prediction', set.prediction).where('set', set.set).del();
            // we will delete the set itself after the transaction
        }

        await tx('predictions').where('id', existing.id).del();
    });

    // delete the signal sets
    for (let set of setsToDelete) {
        await removeSigSetById(context, set.set);
    }

    // clean up the jobs
    for (let job of jobsToDelete) {
        await jobs.remove(context, job.job);
    }

    return val;
}

async function _deleteTypeSpecificTx(tx, context, predictionId, type) {
    if (type in deleteCallbacks) {
        return await deleteCallbacks[type](tx, context, predictionId);
    }
}

function _isValidType(type) {
    for (let t in PredictionTypes) {
        if (PredictionTypes[t] === type) {
            return true;
        }
    }
    return false;
}

async function _validate(context, tx, prediction) {
    await namespaceHelpers.validateEntity(tx, prediction);
    await enforce(_isValidType(prediction.type), "Invalid prediction type.");
}

async function _createPredictionTx(tx, context, prediction) {
    await shares.enforceEntityPermissionTx(tx, context, 'signalSet', prediction.set, 'createPrediction');
    await _validate(context, tx, prediction);

    const filteredEntity = filterObject(prediction, allowedKeys);
    filteredEntity.settings = JSON.stringify(filteredEntity.settings);
    filteredEntity.signals = JSON.stringify(filteredEntity.signals);

    const inserted_ids = await tx('predictions').insert(filteredEntity);
    const id = inserted_ids[0];

    await shares.rebuildPermissionsTx(tx, {
        entityTypeId: 'prediction',
        entityId: id
    });

    return id;
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'prediction', id, 'view');
        const entity = await tx('predictions').where('id', id).first();
        entity.settings = JSON.parse(entity.settings);
        entity.signals = JSON.parse(entity.signals);
        entity.permissions = await shares.getPermissionsTx(tx, context, 'prediction', id);

        return entity;
    });
}

async function _createOutSignalSet(tx, context, signalSet, predictionId) {
    const filteredSet = filterObject(signalSet, allowedSignalSetKeysCreate);
    filteredSet.type = SignalSetType.COMPUTED;
    filteredSet.kind = SignalSetKind.TIME_SERIES;

    const setId = await createSigSet(tx, context, filteredSet);
    await tx('predictions_signal_sets').insert({
        prediction: predictionId,
        set: setId
    });

    // timestamp signal created by signal set create API
    const tsSignal = await tx('signals').where('set', setId).where('cid', 'ts').first();
    await tx('predictions_signals').insert({
        prediction: predictionId,
        signal: tsSignal.id
    });

    return setId;
}

async function _createOutSignal(tx, context, signal, predictionId) {
    let filteredSignal = filterObject(signal, allowedSignalKeysCreate);
    filteredSignal.source = SignalSource.JOB;
    const sigId = await createSignal(tx, context, filteredSignal.set, filteredSignal);
    await tx('predictions_signals').insert({
        prediction: predictionId,
        signal: sigId
    });
    return sigId;
}

function _generateSignalSet(cid, namespace) {
    return {
        cid: cid,
        name: cid,
        decription: "",
        namespace: namespace,
    };
}

async function _createOutputSignalSetWithSignals(tx, context, setCid, signals, predictionId, namespace, extraSignals = []) {
    const signalSet = _generateSignalSet(setCid, namespace);
    const setId = await _createOutSignalSet(tx, context, signalSet, predictionId);

    for (let signal of signals) {
        signal.set = setId;
        await _createOutSignal(tx, context, signal, predictionId);
    }

    for (let signal of extraSignals) {
        signal.set = setId;
        await _createOutSignal(tx, context, signal, predictionId);
    }
}

function _stripNonPrintable(string) {
    // strip characters other than:
    //     A-Za-z letters
    //     0-9    numbers
    //     _.-
    let regexp = /[^0-9A-Za-z_.-]+/g;
    return string.replace(regexp, '');
}

async function getPrefix(tx, context, modelId) {
    shares.enforceEntityPermissionTx(tx, context, 'prediction', modelId, 'view');
    const prediction = await tx('predictions').where('id', modelId).first();
    const sourceSet = await tx('signal_sets').where('id', prediction.set).first();

    const cid = _stripNonPrintable(prediction.name);
    const setPrefix = `${sourceSet.cid}_${prediction.type}_${prediction.id}_${cid}`;

    return setPrefix;
}

async function _createOutputSignalSets(tx, context, prediction, outSignals, extraSignals = []) {
    const setPrefix = await getPrefix(tx, context, prediction.id);

    for (let i = 1; i <= prediction.ahead_count; i++) {
        const setCid = `${setPrefix}_${i}ahead`;
        await _createOutputSignalSetWithSignals(tx, context, setCid, outSignals, prediction.id, prediction.namespace, extraSignals);
    }

    const futureSetCid = `${setPrefix}_future`;
    await _createOutputSignalSetWithSignals(tx, context, futureSetCid, outSignals, prediction.id, prediction.namespace, extraSignals);

    return {};
}

async function _rebuildOuputOwnership(tx, context, modelId) {
    shares.enforceEntityPermissionTx(tx, context, 'prediction', modelId, 'edit');

    const jobs = await tx('predictions_jobs').where('prediction', modelId);
    const sets = await tx('predictions_signal_sets').where('prediction', modelId);

    for (let job of jobs) {
        for (let set of sets) {
            const signal_set_owner = {
                set: set.set,
                job: job.job
            };

            const alreadyExists = await tx('signal_sets_owners').where('set', set.set).where('job', job.job);
            if (alreadyExists.length < 1) {
                await tx('signal_sets_owners').insert(signal_set_owner);
            }
        }
    }
}


module.exports.getById = getById;
module.exports.removeById = removeById;
module.exports.registerPredictionModelTx = registerPredictionModelTx;
module.exports.registerPredictionModelJobTx = registerPredictionModelJobTx;
module.exports.update = update;
module.exports.getOutputConfigTx = getOutputConfigTx;
module.exports.getOutputConfig = getOutputConfig;
module.exports.listDTAjax = listDTAjax;
module.exports.hash = hash;