# Templates

## How to set default interval or aggregation?
In your template is a component `TimeContext`. You can pass it `initialIntervalSpec` prop:
```ecmascript 6
<TimeContext initialIntervalSpec={new IntervalSpec('now-5d', 'now',  moment.duration(1, 'h'), moment.duration(1, 'm'))}>
```

Parameters are from, to, Aggregation by, Refreshing every. Therefore, in the example setting is for the last 5 days, aggregated by an hour, refreshed every minute. 

Don't forget to add imports:
```ecmascript 6
import {IntervalSpec} from "ivis";
import moment from 'moment';
```