import React, {Component} from "react";

export class Debug extends Component {
    stringifyProp(prop, key) {
        if (prop[key] && typeof prop[key] === 'object')
            return (
                <li key={key.toString()}>
                    <b>{key.toString()}:</b>
                    <ul>
                        {this.stringifyProps(prop[key])}
                    </ul>
                </li>
            );
        else if (prop[key] && typeof prop[key] === "function")
            return (
                <li key={key.toString()}>
                    <b>{key.toString()}:</b> {prop[key].name}
                </li>
            );
        else
            return (
                <li key={key.toString()}>
                    <b>{key.toString()}:</b> {prop[key]}
                </li>
            );
    }

    stringifyProps(props) {
        return Object.keys(props).map(key => this.stringifyProp(props, key));
    }

    render() {
        return (
            <div>
                <h2> Debug </h2>
                <ul>
                    <li>
                        <h3> Props </h3>

                        <ol>
                            {this.stringifyProps(this.props)}
                        </ol>
                    </li>
                </ul>
            </div>
        );
    }
}
