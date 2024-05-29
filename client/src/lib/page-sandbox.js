'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {BrowserRouter as Router, Route, Routes} from "react-router-dom";
import {withErrorHandling} from "./error-handling";
import styles from "./styles-content.scss";
import {getRoutes, RenderRoute, Resolver, SectionContentContext, withPageHelpers} from "./page-common";
import {getBaseDir} from "./urls";
import {parentRPC} from "./untrusted";
import {withComponentMixins} from "./decorator-helpers";

import {ThemeContext} from "./theme-context";
import {Theme} from "../../../shared/themes";
import {withTranslation} from "./i18n";

export {withPageHelpers}

function getLoadingMessage(t) {
    return (
        <div className="container-fluid">
            <div className={styles.loadingMessage}>{t('Loading...')}</div>
        </div>
    );
}

function getTheme(search){
    const searchParams = new URLSearchParams(search);
    let theme = Theme.LIGHT;
    if (searchParams.has('theme')) {
        theme = searchParams.get('theme') === Theme.DARK ? Theme.DARK : Theme.LIGHT;
    }
    return theme;
}

@withComponentMixins([
    withTranslation
])
class PanelRoute extends Component {
    static propTypes = {
        route: PropTypes.object.isRequired,
        location: PropTypes.object.isRequired,
    }

    componentDidMount() {
        this.updateBodyClasses();
    }

    componentDidUpdate(prevProps) {
        this.updateBodyClasses();
    }

    componentWillUnmount() {
        document.body.classList.remove('inside-iframe', 'theme-dark');
    }

    updateBodyClasses() {
        const { route, location } = this.props;

        if (route.insideIframe) {
            document.body.classList.add('inside-iframe');
        } else {
            document.body.classList.remove('inside-iframe');
        }

        let theme = getTheme(location.search);
        if (theme === Theme.DARK) {
            document.body.classList.add('theme-dark');
        } else {
            document.body.classList.remove('theme-dark');
        }
    }

    render() {
        const { t, route } = this.props;

        const render = (resolved, permissions) => {
            if (resolved && permissions) {
                const compProps = {
                    location: this.props.location,
                    resolved,
                    permissions
                };

                let panel;
                if (route.panelComponent) {
                    panel = React.createElement(route.panelComponent, compProps);
                } else if (route.panelRender) {
                    panel = route.panelRender(compProps);
                }

                let cls = `container-fluid`;

                return (
                    <div className={cls}>
                        <ThemeContext.Provider value={getTheme(this.props.location.search)}>
                            {panel}
                        </ThemeContext.Provider>
                    </div>
                );

            } else {
                return getLoadingMessage(t);
            }
        };
        return <Resolver key={route.path} route={route} render={render} params={this.props.params} location={this.props.location}/>;
    }
}

@withComponentMixins([
    withTranslation,
    withErrorHandling
])
export class SectionContent extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    static propTypes = {
        structure: PropTypes.object.isRequired,
        root: PropTypes.string.isRequired
    }

    setFlashMessage(severity, text) {
        parentRPC.ask('setFlashMessage', {severity, text})
    }

    navigateTo(path) {
        parentRPC.ask('navigateTo', {path});
    }

    navigateBack() {
        parentRPC.ask('navigateBack');
    }

    navigateToWithFlashMessage(path, severity, text) {
        parentRPC.ask('navigateToWithFlashMessage', {path, severity, text});
    }

    registerBeforeUnloadHandlers(handlers) {
        // This is not implemented because we don't have a case yet when it would be needed. This might become needed when a panel has a form that needs saving, or similar.
    }

    deregisterBeforeUnloadHandlers(handlers) {
        // Dtto (as above)
    }

    errorHandler(error) {
        if (error.response && error.response.data && error.response.data.message) {
            console.error(error);
            this.setFlashMessage('danger', error.response.data.message);
        } else {
            console.error(error);
            this.setFlashMessage('danger', error.message);
        }
        return true;
    }

    renderRoute(route) {
        return (
            <Route
                key={route.path}
                path={route.path}
                element={<RenderRoute
                    route={route}
                    panelRouteCtor={PanelRoute}
                    loadingMessageFn={() => getLoadingMessage(this.props.t)}
                />}
            />
        );
    }

    render() {
        let routes = getRoutes(this.props.structure);

        return (
            <SectionContentContext.Provider value={this}>
                <Routes>{
                    routes.map(x => this.renderRoute(x))
                }
                </Routes>
            </SectionContentContext.Provider>
        );
    }
}

@withComponentMixins([
    withTranslation
])
export class Section extends Component {
    constructor(props) {
        super(props);

        let structure = props.structure;
        if (typeof structure === 'function') {
            structure = structure(props.t);
        }

        this.structure = structure;
    }

    static propTypes = {
        structure: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
        root: PropTypes.string.isRequired
    }

    render() {
        return (
            <Router basename={getBaseDir()}>
                <SectionContent root={this.props.root} structure={this.structure}/>
            </Router>
        );
    }
}
