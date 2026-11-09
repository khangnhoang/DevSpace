import { noteTimedOutTests } from "../helpers/api-timeout-note";
import { sharedRunMarker } from "../helpers/fixture-ownership";

// Every file of the `api` project: a timed-out test marks the run unclean (the global setup already refused to start
// outside an active run, so the shared state exists).
noteTimedOutTests(sharedRunMarker);
