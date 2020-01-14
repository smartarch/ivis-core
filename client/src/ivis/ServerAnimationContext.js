import React, {Component} from "react";
import {Debug} from "./Debug";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls"

export class ServerAnimationContext extends Component {
    constructor(props) {
        super(props);
        this.state = {
            data: undefined
        }
    }

    static propTypes = {

    }

    async fetchData() {
        const data = await axios.get(getUrl('rest/animation/server/init/'));
        this.setState({data});
    }

    componentDidMount() {
        this.fetchData();
    }

    render() {
        return (
            <>
                <Debug data={this.state.data} animation_context={this.props}/>
            </>
        );
    }
}

