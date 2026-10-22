import { MATH_TRIG_FUNCTIONS } from './mathTrig';
import { TEXT_FUNCTIONS } from './text';
import { DATE_TIME_FUNCTIONS } from './dateTime';
import { CONVERSION_FUNCTIONS } from './conversion';
import { AGGREGATION_FUNCTIONS } from './aggregation';
import { FILTER_FUNCTIONS } from './filter';
import { RELATIONSHIP_FUNCTIONS } from './relationships';
import { FunctionDefinition } from '../expr/registry';

export const ALL_SCALAR_FUNCTIONS: Record<string, FunctionDefinition> = {
  ...MATH_TRIG_FUNCTIONS,
  ...TEXT_FUNCTIONS,
  ...DATE_TIME_FUNCTIONS,
  ...CONVERSION_FUNCTIONS,
  ...AGGREGATION_FUNCTIONS,
  ...FILTER_FUNCTIONS,
  ...RELATIONSHIP_FUNCTIONS,
};

export {
  MATH_TRIG_FUNCTIONS,
  TEXT_FUNCTIONS,
  DATE_TIME_FUNCTIONS,
  CONVERSION_FUNCTIONS,
  AGGREGATION_FUNCTIONS,
  FILTER_FUNCTIONS,
  RELATIONSHIP_FUNCTIONS,
};
