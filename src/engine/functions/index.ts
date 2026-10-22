import { MATH_TRIG_FUNCTIONS } from './mathTrig';
import { TEXT_FUNCTIONS } from './text';
import { DATE_TIME_FUNCTIONS } from './dateTime';
import { CONVERSION_FUNCTIONS } from './conversion';
import { FunctionDefinition } from '../expr/registry';

export const ALL_SCALAR_FUNCTIONS: Record<string, FunctionDefinition> = {
  ...MATH_TRIG_FUNCTIONS,
  ...TEXT_FUNCTIONS,
  ...DATE_TIME_FUNCTIONS,
  ...CONVERSION_FUNCTIONS,
};

export { MATH_TRIG_FUNCTIONS, TEXT_FUNCTIONS, DATE_TIME_FUNCTIONS, CONVERSION_FUNCTIONS };
