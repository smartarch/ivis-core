import React, {Component} from "react";
import {PropTypes} from "prop-types";

export class Debug extends Component {
    static propTypes = {
        funcs: PropTypes.array,
        name: PropTypes.string,
    }

    stringifyProp(prop, key) {
        if (prop[key] && typeof prop[key] === "object") {
            return (
                <li key={key.toString()}>
                    <b>{key.toString()}:</b>
                    <ul>
                        {this.stringifyProps(prop[key])}
                    </ul>
                </li>
            );
        } else if (prop[key] && typeof prop[key] === "function") {
            return (
                <li key={key.toString()}>
                    <b>{key.toString()}:</b> {prop[key].name}
                </li>
            );
        } else {
            return (
                <li key={key.toString()}>
                    <b>{key.toString()}:</b> {String(prop[key])}
                </li>
            );
        }
    }

    stringifyProps(props) {
        return Object.keys(props).map(key => this.stringifyProp(props, key));
    }

    displayFunc(func) {
        return (
            <button key={func.name} className="btn btn-secondary" onClick={func.call}>
                {func.name}
            </button>
        );
    }

    render() {
        const functionsDisplay = (
            <>
                <h3> Functions </h3>
                {this.props.funcs && this.props.funcs.map(func => this.displayFunc(func))}
            </>
        );

        const propsToPrint = {...this.props};
        delete propsToPrint.funcs;
        delete propsToPrint.name;

        return (
            <div>
                <h2>{ this.props.name }</h2>

                { this.props.funcs && functionsDisplay }
                <ul>
                    <li>
                        <h3> Props </h3>

                        <ol>
                            {this.stringifyProps(propsToPrint)}
                        </ol>
                    </li>
                </ul>
            </div>
        );
    }
}
