'use strict';

import React, {Component} from "react";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withErrorHandling} from "../lib/error-handling";
import {withPageHelpers} from "../lib/page";

@withComponentMixins([
    withErrorHandling,
    withPageHelpers,
])
export default class HelloWorld extends Component {
    render() {
      return (
          <div>{this.props.message}</div>
      );
    }
}
