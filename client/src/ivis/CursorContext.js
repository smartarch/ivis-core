'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {createComponentMixin, withComponentMixins} from "../lib/decorator-helpers";
import {panelConfigAccessMixin} from "./PanelConfig";

const defaultCursorName = 'time';

export const CursorReactContext = React.createContext(null);

@withComponentMixins([
    panelConfigAccessMixin
])
export class CursorContext extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        for (const name of props.cursorNames)
            this.state[name] = null;

        this.exportData();
    }

    exportData() {
        const owner = this.props.panelConfigOwner;
        if (owner) {
            owner.updatePanelConfig(this.props.configPath, { cursors: this.state });
        }
    };

    getCursor(name) {
        return this.state[name];
    }

    setCursor(name, value) {
        if (!this.state.hasOwnProperty(name))
            throw new Error(`Cursor "${name}" not specified in 'cursorNames' prop of CursorContext`);
        if (this.state[name] !== value)
            this.setState({ [name]: value }, ::this.exportData);
    }

    static propTypes = {
        cursorNames: PropTypes.array.isRequired,
        configPath: PropTypes.array,
    }

    static defaultProps = {
        configPath: ['cursorContext'],
        cursorNames: [defaultCursorName],
    }

    render() {
        return (
            <CursorReactContext.Provider value={{
                self: this,
                cursors: this.state,
            }}>
                {this.props.children}
            </CursorReactContext.Provider>
        );
    }
}

export function cursorAccessMixin(cursorName = defaultCursorName) {
    return createComponentMixin({
        contexts: [{context: CursorReactContext, propName: 'cursorContext'}],
        decoratorFn: (TargetClass, InnerClass) => {
            const inst = InnerClass.prototype;

            inst.getCursor = function (props) {
                props = props || this.props;
                if (props.cursorContext !== undefined && props.cursorContext !== null)
                    return props.cursorContext.cursors[cursorName];
                return null;
            };

            inst.setCursor = function (value) {
                if (this.props.cursorContext !== undefined && this.props.cursorContext !== null)
                    this.props.cursorContext.self.setCursor(cursorName, value);
            }

            inst.getCursorByName = function (name, props) {
                props = props || this.props;
                name = name || cursorName;
                if (props.cursorContext !== undefined && props.cursorContext !== null)
                    return props.cursorContext.cursors[name];
                return null;
            };

            inst.setCursorByName = function (name, value) {
                name = name || cursorName;
                if (this.props.cursorContext !== undefined && this.props.cursorContext !== null)
                    this.props.cursorContext.self.setCursor(name, value);
            }

            return {};
        }
    });
}

export function withCursorAccess(cursorName = defaultCursorName) {
    return withComponentMixins([
        cursorAccessMixin(cursorName)
    ]);
}
