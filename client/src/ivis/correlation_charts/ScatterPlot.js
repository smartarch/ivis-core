'use strict';

import React, {Component} from "react";
import {intervalAccessMixin} from "../TimeContext";
import {withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {ScatterPlotBase} from "./ScatterPlotBase";
import styles from "../TimeRangeSelector.scss"; // FIXME use own styles
import {ActionLink, Button, Icon} from "../../lib/bootstrap-components";
import {CheckBox, Form, InputField, withForm} from "../../lib/form";

@withComponentMixins([
    withTranslation,
    withForm
])
class ScatterPlotToolbar extends Component {
    constructor(props) {
        super(props);

        this.state = {
            opened: false
        };

        this.initForm();
    }

    static propTypes = {
        resetLimitsClick: PropTypes.func.isRequired,
        zoomOutClick: PropTypes.func.isRequired,
        zoomInClick: PropTypes.func.isRequired,
        reloadDataClick: PropTypes.func.isRequired,
        brushClick: PropTypes.func,
        setSettings: PropTypes.func,
        setLimits: PropTypes.func,
        withSettings: PropTypes.bool.isRequired,
        settings: PropTypes.object,
        brushInProgress: PropTypes.bool
    };

    componentDidMount() {
        this.updateFormValues();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.settings !== prevProps.settings)
            this.updateFormValues();
    }

    updateFormValues() {
        let settings = this.props.settings;
        if (settings.maxDotCount < 0)
            settings.maxDotCount = "";
        if (isNaN(settings.xMin)) settings.xMin = "";
        if (isNaN(settings.xMax)) settings.xMax = "";
        if (isNaN(settings.yMin)) settings.yMin = "";
        if (isNaN(settings.yMax)) settings.yMax = "";

        this.populateFormValues(settings);
    }

    localValidateFormValues(state) {
        this.validateNumber(state, "maxDotCount", "Maximum number of dots must be empty or a number.")
        this.validateNumber(state, "xMin","X axis minimum must be empty or a number.");
        this.validateNumber(state, "xMax","Y axis maximum must be empty or a number.");
        this.validateNumber(state, "yMin","Y axis minimum must be empty or a number.");
        this.validateNumber(state, "yMax","Y axis maximum must be empty or a number.");
    }

    validateNumber(state, numberFormId, errorMessage) {
        const t = this.props.t;
        const num = state.getIn([numberFormId, 'value']);
        if (num !== undefined && num !== "" && isNaN(num)) {
            state.setIn([numberFormId, 'error'], t(errorMessage));
        }
        else
            state.setIn([numberFormId, 'error'], null);
    }

    async submitForm() {
        if (this.isFormWithoutErrors()) {
            let maxDotCount = this.getFormValue('maxDotCount');
            let xMin = this.getFormValue("xMin");
            let xMax = this.getFormValue("xMax");
            let yMin = this.getFormValue("yMin");
            let yMax = this.getFormValue("yMax");
            const withTooltip = this.getFormValue('withTooltip');

            if (maxDotCount === undefined || maxDotCount === "")
                maxDotCount = -1;
            else
                maxDotCount = parseInt(maxDotCount);
            xMin = parseFloat(xMin);
            xMax = parseFloat(xMax);
            yMin = parseFloat(yMin);
            yMax = parseFloat(yMax);

            this.props.setSettings(maxDotCount, withTooltip);
            this.props.setLimits(xMin, xMax, yMin, yMax);

            this.setState({
                opened: false
            });

        } else {
            this.showFormValidation();
        }
    }

    render() {
        const t = this.props.t;

        if (this.props.withSettings) {
            return (
                <div className="card">
                    <div className="card-header" onClick={() => this.setState({opened: !this.state.opened})}>
                        <div className={styles.headingButtons}>
                            <ActionLink onClickAsync={async () => this.props.zoomOutClick()}><Icon icon="search-minus" title={t('Zoom out')}/></ActionLink>
                            <ActionLink onClickAsync={async () => this.props.zoomInClick()}><Icon icon="search-plus" title={t('Zoom in')}/></ActionLink>
                            <ActionLink onClickAsync={async () => this.props.reloadDataClick()}><Icon icon="sync-alt" title={t('Reload data')}/></ActionLink>
                            {this.props.brushClick &&
                            <ActionLink onClickAsync={async () => this.props.brushClick()}>
                                {!this.props.brushInProgress && <Icon icon="edit" title={t('Select area')}/>}
                                { this.props.brushInProgress && <Icon icon="pen-square" title={t('Cancel selection')}/>}
                            </ActionLink>}
                            <ActionLink onClickAsync={async () => this.props.resetLimitsClick()}><Icon icon="backspace" title={t('Reset zoom')}/></ActionLink>
                            <ActionLink onClickAsync={async () => this.setState({opened: !this.state.opened})}><Icon icon="sliders-h" title={t('Open settings')}/></ActionLink>
                        </div>
                    </div>
                    {this.state.opened &&
                    <div className="card-body">
                        <Form stateOwner={this} onSubmitAsync={::this.submitForm} format="wide">
                            <InputField id="maxDotCount" label={t('Maximum number of dots')}
                                        help={"Keep empty for unlimited."}/>
                            <CheckBox id={"withTooltip"} label={t("Show tooltip")}/>
                            <InputField id="xMin" label={t('X axis minimum')}/>
                            <InputField id="xMax" label={t('X axis maximum')}/>
                            <InputField id="yMin" label={t('Y axis minimum')}/>
                            <InputField id="yMax" label={t('Y axis maximum')}/>
                            <Button type="submit" className="btn-primary" label={t('Apply')}/>
                        </Form>
                    </div>
                    }
                </div>
            );
        } else {
            return (
                <div className="card">
                    <div className="card-header">
                        <div className={styles.headingButtons}>
                            <ActionLink onClickAsync={async () => this.props.resetLimitsClick()}><Icon icon="search-minus" title={t('Reset zoom')}/></ActionLink>
                        </div>
                    </div>
                </div>
            );
        }
    }
}

@withComponentMixins([
    withTranslation,
    withErrorHandling
])
export class ScatterPlot extends Component {
    constructor(props) {
        super(props);

        this.state = {
            xMin: NaN,
            xMax: NaN,
            yMin: NaN,
            yMax: NaN,
            brushInProgress: false
        };

        if (props.withSettings) {
            this.state.withTooltip = props.withTooltip;
            this.state.maxDotCount = props.maxDotCount;
        }

        this.boundSetDefaultLimits = ::this.setDefaultLimits;
        this.boundSetLimits = ::this.setLimits;
        this.boundSetSettings = ::this.setSettings;
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                X_sigCid: PropTypes.string.isRequired,
                Y_sigCid: PropTypes.string.isRequired,
                color: PropTypes.object.isRequired,
                label: PropTypes.string,
                enabled: PropTypes.bool,
                dotRadius: PropTypes.number, // default = props.dotRadius; used when dotSize_sigCid is not specified
                dotSize_sigCid: PropTypes.string, // used for BubblePlot
                X_label: PropTypes.string,
                Y_label: PropTypes.string,
                Size_label: PropTypes.string, // for BubblePlot
                regressions: PropTypes.arrayOf(PropTypes.shape({
                    type: PropTypes.string.isRequired,
                    color: PropTypes.object,
                    bandwidth: PropTypes.number    // for LOESS
                }))
            })).isRequired
        }).isRequired,
        maxDotCount: PropTypes.number, // set to negative number for unlimited
        dotRadius: PropTypes.number,
        minDotRadius: PropTypes.number, // for BubblePlot
        maxDotRadius: PropTypes.number, // for BubblePlot
        minDotRadiusValue: PropTypes.number, // for BubblePlot
        maxDotRadiusValue: PropTypes.number, // for BubblePlot
        highlightDotRadius: PropTypes.number, // radius multiplier
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        withBrush: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withTransition: PropTypes.bool,
        withSettings: PropTypes.bool,
        withRegressionCoefficients: PropTypes.bool,
        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
        zoomLevelStepFactor: PropTypes.number
    };

    static defaultProps = {
        withBrush: true,
        withTooltip: true,
        withTransition: true,
        withSettings: true,
        zoomLevelMin: 1,
        zoomLevelMax: 4,
        zoomLevelStepFactor: 1.5
    };

    setDefaultLimits() {
        this.setLimits(NaN, NaN, NaN, NaN);
        this.scatterPlotBase.resetZoom();
    }

    setLimits(xMin, xMax, yMin, yMax) {
        this.setState({
            xMin: xMin,
            xMax: xMax,
            yMin: yMin,
            yMax: yMax
        });
    }

    setSettings(maxDotCount, withTooltip) {
        this.setState({
            maxDotCount,
            withTooltip
        });
    }

    render() {
        const state = this.state;

        if (this.props.withSettings) {
            let props = {...this.props};
            props.withTooltip = state.withTooltip;
            props.maxDotCount = state.maxDotCount;

            return (
                <div>
                    <ScatterPlotToolbar resetLimitsClick={this.boundSetDefaultLimits}
                                        withSettings={true}
                                        setSettings={this.boundSetSettings}
                                        setLimits={this.boundSetLimits}
                                        settings={{
                                            xMin: state.xMin,
                                            xMax: state.xMax,
                                            yMin: state.yMin,
                                            yMax: state.yMax,
                                            withTooltip: state.withTooltip,
                                            maxDotCount: state.maxDotCount
                                        }}
                                        zoomInClick={() => this.scatterPlotBase.zoomIn()}
                                        zoomOutClick={() => this.scatterPlotBase.zoomOut()}
                                        reloadDataClick={() => this.scatterPlotBase.setLimitsToCurrentZoom()}
                                        brushClick={this.props.withBrush ? () => this.setState({
                                            brushInProgress: this.scatterPlotBase.drawBrush()
                                        }) : undefined}
                                        brushInProgress={this.state.brushInProgress}
                    />
                    <ScatterPlotBase {...props}
                                     setLimits={this.boundSetLimits}
                                     xMin={state.xMin}
                                     xMax={state.xMax}
                                     yMin={state.yMin}
                                     yMax={state.yMax}
                                     ref={node => this.scatterPlotBase = node}
                    />
                </div>
            );
        } else {
            return (<div>
                    <ScatterPlotToolbar resetLimitsClick={this.boundSetDefaultLimits}
                                        withSettings={false}
                                        zoomInClick={() => this.scatterPlotBase.zoomIn()}
                                        zoomOutClick={() => this.scatterPlotBase.zoomOut()}
                                        reloadDataClick={() => this.scatterPlotBase.setLimitsToCurrentZoom()}
                                        brushClick={this.props.withBrush ? () => this.setState({
                                            brushInProgress: this.scatterPlotBase.drawBrush()
                                        }) : undefined}
                                        brushInProgress={this.state.brushInProgress}
                    />
                    <ScatterPlotBase {...this.props}
                                     setLimits={this.boundSetLimits}
                                     xMin={state.xMin}
                                     xMax={state.xMax}
                                     yMin={state.yMin}
                                     yMax={state.yMax}
                                     ref={node => this.scatterPlotBase = node}
                    />
                </div>
            );
        }
    }
}