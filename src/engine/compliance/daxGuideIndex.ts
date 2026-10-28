/**
 * Exact canonical index of all known functions in DAX Guide (https://dax.guide/)
 * Total functions ~380.
 * Serves as the single source of truth for DAX language existence and canonical categorization.
 */

export interface DaxGuideEntry {
  name: string;
  category:
    | 'Aggregation'
    | 'Filter'
    | 'Date and Time'
    | 'Time Intelligence'
    | 'Information'
    | 'Logical'
    | 'Math and Trig'
    | 'Financial'
    | 'Statistical'
    | 'Text'
    | 'Table manipulation'
    | 'Relationship'
    | 'Parent-Child'
    | 'Window and Ranking'
    | 'Visual Calculations'
    | 'Calculation Groups'
    | 'Utility';
  guideUrl: string;
}

export const DAX_GUIDE_INDEX: DaxGuideEntry[] = [
  // ==========================================
  // AGGREGATION (26)
  // ==========================================
  { name: 'AVERAGE', category: 'Aggregation', guideUrl: 'https://dax.guide/average/' },
  { name: 'AVERAGEA', category: 'Aggregation', guideUrl: 'https://dax.guide/averagea/' },
  { name: 'AVERAGEX', category: 'Aggregation', guideUrl: 'https://dax.guide/averagex/' },
  { name: 'COUNT', category: 'Aggregation', guideUrl: 'https://dax.guide/count/' },
  { name: 'COUNTA', category: 'Aggregation', guideUrl: 'https://dax.guide/counta/' },
  { name: 'COUNTAX', category: 'Aggregation', guideUrl: 'https://dax.guide/countax/' },
  { name: 'COUNTBLANK', category: 'Aggregation', guideUrl: 'https://dax.guide/countblank/' },
  { name: 'COUNTROWS', category: 'Aggregation', guideUrl: 'https://dax.guide/countrows/' },
  { name: 'COUNTX', category: 'Aggregation', guideUrl: 'https://dax.guide/countx/' },
  { name: 'DISTINCTCOUNT', category: 'Aggregation', guideUrl: 'https://dax.guide/distinctcount/' },
  { name: 'DISTINCTCOUNTNOBLANK', category: 'Aggregation', guideUrl: 'https://dax.guide/distinctcountnoblank/' },
  { name: 'MAX', category: 'Aggregation', guideUrl: 'https://dax.guide/max/' },
  { name: 'MAXA', category: 'Aggregation', guideUrl: 'https://dax.guide/maxa/' },
  { name: 'MAXX', category: 'Aggregation', guideUrl: 'https://dax.guide/maxx/' },
  { name: 'MEDIAN', category: 'Aggregation', guideUrl: 'https://dax.guide/median/' },
  { name: 'MEDIANX', category: 'Aggregation', guideUrl: 'https://dax.guide/medianx/' },
  { name: 'MIN', category: 'Aggregation', guideUrl: 'https://dax.guide/min/' },
  { name: 'MINA', category: 'Aggregation', guideUrl: 'https://dax.guide/mina/' },
  { name: 'MINX', category: 'Aggregation', guideUrl: 'https://dax.guide/minx/' },
  { name: 'PERCENTILE.EXC', category: 'Aggregation', guideUrl: 'https://dax.guide/percentile-exc/' },
  { name: 'PERCENTILE.INC', category: 'Aggregation', guideUrl: 'https://dax.guide/percentile-inc/' },
  { name: 'PERCENTILEX.EXC', category: 'Aggregation', guideUrl: 'https://dax.guide/percentilex-exc/' },
  { name: 'PERCENTILEX.INC', category: 'Aggregation', guideUrl: 'https://dax.guide/percentilex-inc/' },
  { name: 'PRODUCT', category: 'Aggregation', guideUrl: 'https://dax.guide/product/' },
  { name: 'PRODUCTX', category: 'Aggregation', guideUrl: 'https://dax.guide/productx/' },
  { name: 'SUM', category: 'Aggregation', guideUrl: 'https://dax.guide/sum/' },
  { name: 'SUMX', category: 'Aggregation', guideUrl: 'https://dax.guide/sumx/' },

  // ==========================================
  // FILTER (16)
  // ==========================================
  { name: 'ALL', category: 'Filter', guideUrl: 'https://dax.guide/all/' },
  { name: 'ALLEXCEPT', category: 'Filter', guideUrl: 'https://dax.guide/allexcept/' },
  { name: 'ALLNOBLANKROW', category: 'Filter', guideUrl: 'https://dax.guide/allnoblankrow/' },
  { name: 'ALLSELECTED', category: 'Filter', guideUrl: 'https://dax.guide/allselected/' },
  { name: 'CALCULATE', category: 'Filter', guideUrl: 'https://dax.guide/calculate/' },
  { name: 'CALCULATETABLE', category: 'Filter', guideUrl: 'https://dax.guide/calculatetable/' },
  { name: 'EARLIER', category: 'Filter', guideUrl: 'https://dax.guide/earlier/' },
  { name: 'EARLIEST', category: 'Filter', guideUrl: 'https://dax.guide/earliest/' },
  { name: 'FILTER', category: 'Filter', guideUrl: 'https://dax.guide/filter/' },
  { name: 'KEEPFILTERS', category: 'Filter', guideUrl: 'https://dax.guide/keepfilters/' },
  { name: 'LOOKUPVALUE', category: 'Filter', guideUrl: 'https://dax.guide/lookupvalue/' },
  { name: 'REMOVEFILTERS', category: 'Filter', guideUrl: 'https://dax.guide/removefilters/' },
  { name: 'SELECTEDVALUE', category: 'Filter', guideUrl: 'https://dax.guide/selectedvalue/' },

  // ==========================================
  // DATE AND TIME (19)
  // ==========================================
  { name: 'CALENDAR', category: 'Date and Time', guideUrl: 'https://dax.guide/calendar/' },
  { name: 'CALENDARAUTO', category: 'Date and Time', guideUrl: 'https://dax.guide/calendarauto/' },
  { name: 'DATE', category: 'Date and Time', guideUrl: 'https://dax.guide/date/' },
  { name: 'DATEDIFF', category: 'Date and Time', guideUrl: 'https://dax.guide/datediff/' },
  { name: 'DATEVALUE', category: 'Date and Time', guideUrl: 'https://dax.guide/datevalue/' },
  { name: 'DAY', category: 'Date and Time', guideUrl: 'https://dax.guide/day/' },
  { name: 'EDATE', category: 'Date and Time', guideUrl: 'https://dax.guide/edate/' },
  { name: 'EOMONTH', category: 'Date and Time', guideUrl: 'https://dax.guide/eomonth/' },
  { name: 'HOUR', category: 'Date and Time', guideUrl: 'https://dax.guide/hour/' },
  { name: 'MINUTE', category: 'Date and Time', guideUrl: 'https://dax.guide/minute/' },
  { name: 'MONTH', category: 'Date and Time', guideUrl: 'https://dax.guide/month/' },
  { name: 'NOW', category: 'Date and Time', guideUrl: 'https://dax.guide/now/' },
  { name: 'QUARTER', category: 'Date and Time', guideUrl: 'https://dax.guide/quarter/' },
  { name: 'SECOND', category: 'Date and Time', guideUrl: 'https://dax.guide/second/' },
  { name: 'TIME', category: 'Date and Time', guideUrl: 'https://dax.guide/time/' },
  { name: 'TIMEVALUE', category: 'Date and Time', guideUrl: 'https://dax.guide/timevalue/' },
  { name: 'TODAY', category: 'Date and Time', guideUrl: 'https://dax.guide/today/' },
  { name: 'UTCNOW', category: 'Date and Time', guideUrl: 'https://dax.guide/utcnow/' },
  { name: 'UTCTODAY', category: 'Date and Time', guideUrl: 'https://dax.guide/utctoday/' },
  { name: 'WEEKDAY', category: 'Date and Time', guideUrl: 'https://dax.guide/weekday/' },
  { name: 'WEEKNUM', category: 'Date and Time', guideUrl: 'https://dax.guide/weeknum/' },
  { name: 'YEAR', category: 'Date and Time', guideUrl: 'https://dax.guide/year/' },
  { name: 'YEARFRAC', category: 'Date and Time', guideUrl: 'https://dax.guide/yearfrac/' },

  // ==========================================
  // TIME INTELLIGENCE (36)
  // ==========================================
  { name: 'CLOSINGBALANCEMONTH', category: 'Time Intelligence', guideUrl: 'https://dax.guide/closingbalancemonth/' },
  { name: 'CLOSINGBALANCEQUARTER', category: 'Time Intelligence', guideUrl: 'https://dax.guide/closingbalancequarter/' },
  { name: 'CLOSINGBALANCEYEAR', category: 'Time Intelligence', guideUrl: 'https://dax.guide/closingbalanceyear/' },
  { name: 'DATEADD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/dateadd/' },
  { name: 'DATESBETWEEN', category: 'Time Intelligence', guideUrl: 'https://dax.guide/datesbetween/' },
  { name: 'DATESINPERIOD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/datesinperiod/' },
  { name: 'DATESMTD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/datesmtd/' },
  { name: 'DATESQTD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/datesqtd/' },
  { name: 'DATESYTD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/datesytd/' },
  { name: 'ENDOFMONTH', category: 'Time Intelligence', guideUrl: 'https://dax.guide/endofmonth/' },
  { name: 'ENDOFQUARTER', category: 'Time Intelligence', guideUrl: 'https://dax.guide/endofquarter/' },
  { name: 'ENDOFYEAR', category: 'Time Intelligence', guideUrl: 'https://dax.guide/endofyear/' },
  { name: 'FIRSTDATE', category: 'Time Intelligence', guideUrl: 'https://dax.guide/firstdate/' },
  { name: 'FIRSTNONBLANK', category: 'Time Intelligence', guideUrl: 'https://dax.guide/firstnonblank/' },
  { name: 'FIRSTNONBLANKVALUE', category: 'Time Intelligence', guideUrl: 'https://dax.guide/firstnonblankvalue/' },
  { name: 'LASTDATE', category: 'Time Intelligence', guideUrl: 'https://dax.guide/lastdate/' },
  { name: 'LASTNONBLANK', category: 'Time Intelligence', guideUrl: 'https://dax.guide/lastnonblank/' },
  { name: 'LASTNONBLANKVALUE', category: 'Time Intelligence', guideUrl: 'https://dax.guide/lastnonblankvalue/' },
  { name: 'NEXTDAY', category: 'Time Intelligence', guideUrl: 'https://dax.guide/nextday/' },
  { name: 'NEXTMONTH', category: 'Time Intelligence', guideUrl: 'https://dax.guide/nextmonth/' },
  { name: 'NEXTQUARTER', category: 'Time Intelligence', guideUrl: 'https://dax.guide/nextquarter/' },
  { name: 'NEXTYEAR', category: 'Time Intelligence', guideUrl: 'https://dax.guide/nextyear/' },
  { name: 'OPENINGBALANCEMONTH', category: 'Time Intelligence', guideUrl: 'https://dax.guide/openingbalancemonth/' },
  { name: 'OPENINGBALANCEQUARTER', category: 'Time Intelligence', guideUrl: 'https://dax.guide/openingbalancequarter/' },
  { name: 'OPENINGBALANCEYEAR', category: 'Time Intelligence', guideUrl: 'https://dax.guide/openingbalanceyear/' },
  { name: 'PARALLELPERIOD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/parallelperiod/' },
  { name: 'PREVIOUSDAY', category: 'Time Intelligence', guideUrl: 'https://dax.guide/previousday/' },
  { name: 'PREVIOUSMONTH', category: 'Time Intelligence', guideUrl: 'https://dax.guide/previousmonth/' },
  { name: 'PREVIOUSQUARTER', category: 'Time Intelligence', guideUrl: 'https://dax.guide/previousquarter/' },
  { name: 'PREVIOUSYEAR', category: 'Time Intelligence', guideUrl: 'https://dax.guide/previousyear/' },
  { name: 'SAMEPERIODLASTYEAR', category: 'Time Intelligence', guideUrl: 'https://dax.guide/sameperiodlastyear/' },
  { name: 'STARTOFMONTH', category: 'Time Intelligence', guideUrl: 'https://dax.guide/startofmonth/' },
  { name: 'STARTOFQUARTER', category: 'Time Intelligence', guideUrl: 'https://dax.guide/startofquarter/' },
  { name: 'STARTOFYEAR', category: 'Time Intelligence', guideUrl: 'https://dax.guide/startofyear/' },
  { name: 'TOTALMTD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/totalmtd/' },
  { name: 'TOTALQTD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/totalqtd/' },
  { name: 'TOTALYTD', category: 'Time Intelligence', guideUrl: 'https://dax.guide/totalytd/' },

  // ==========================================
  // INFORMATION (24)
  // ==========================================
  { name: 'CONTAINS', category: 'Information', guideUrl: 'https://dax.guide/contains/' },
  { name: 'CONTAINSROW', category: 'Information', guideUrl: 'https://dax.guide/containsrow/' },
  { name: 'CUSTOMDATA', category: 'Information', guideUrl: 'https://dax.guide/customdata/' },
  { name: 'HASONEFILTER', category: 'Information', guideUrl: 'https://dax.guide/hasonefilter/' },
  { name: 'HASONEVALUE', category: 'Information', guideUrl: 'https://dax.guide/hasonevalue/' },
  { name: 'ISAFTER', category: 'Information', guideUrl: 'https://dax.guide/isafter/' },
  { name: 'ISBLANK', category: 'Information', guideUrl: 'https://dax.guide/isblank/' },
  { name: 'ISCROSSFILTERED', category: 'Information', guideUrl: 'https://dax.guide/iscrossfiltered/' },
  { name: 'ISEMPTY', category: 'Information', guideUrl: 'https://dax.guide/isempty/' },
  { name: 'ISERROR', category: 'Information', guideUrl: 'https://dax.guide/iserror/' },
  { name: 'ISEVEN', category: 'Information', guideUrl: 'https://dax.guide/iseven/' },
  { name: 'ISFILTERED', category: 'Information', guideUrl: 'https://dax.guide/isfiltered/' },
  { name: 'ISINSCOPE', category: 'Information', guideUrl: 'https://dax.guide/isinscope/' },
  { name: 'ISLOGICAL', category: 'Information', guideUrl: 'https://dax.guide/islogical/' },
  { name: 'ISNONTEXT', category: 'Information', guideUrl: 'https://dax.guide/isnontext/' },
  { name: 'ISNUMBER', category: 'Information', guideUrl: 'https://dax.guide/isnumber/' },
  { name: 'ISODD', category: 'Information', guideUrl: 'https://dax.guide/isodd/' },
  { name: 'ISONORAFTER', category: 'Information', guideUrl: 'https://dax.guide/isonorafter/' },
  { name: 'ISSUBTOTAL', category: 'Information', guideUrl: 'https://dax.guide/issubtotal/' },
  { name: 'ISTEXT', category: 'Information', guideUrl: 'https://dax.guide/istext/' },
  { name: 'USERCULTURE', category: 'Information', guideUrl: 'https://dax.guide/userculture/' },
  { name: 'USERNAME', category: 'Information', guideUrl: 'https://dax.guide/username/' },
  { name: 'USEROBJECTID', category: 'Information', guideUrl: 'https://dax.guide/userobjectid/' },
  { name: 'USERPRINCIPALNAME', category: 'Information', guideUrl: 'https://dax.guide/userprincipalname/' },

  // ==========================================
  // LOGICAL (9)
  // ==========================================
  { name: 'AND', category: 'Logical', guideUrl: 'https://dax.guide/and/' },
  { name: 'BITAND', category: 'Logical', guideUrl: 'https://dax.guide/bitand/' },
  { name: 'BITLSHIFT', category: 'Logical', guideUrl: 'https://dax.guide/bitlshift/' },
  { name: 'BITOR', category: 'Logical', guideUrl: 'https://dax.guide/bitor/' },
  { name: 'BITRSHIFT', category: 'Logical', guideUrl: 'https://dax.guide/bitrshift/' },
  { name: 'BITXOR', category: 'Logical', guideUrl: 'https://dax.guide/bitxor/' },
  { name: 'COALESCE', category: 'Logical', guideUrl: 'https://dax.guide/coalesce/' },
  { name: 'FALSE', category: 'Logical', guideUrl: 'https://dax.guide/false/' },
  { name: 'IF', category: 'Logical', guideUrl: 'https://dax.guide/if/' },
  { name: 'IF.EAGER', category: 'Logical', guideUrl: 'https://dax.guide/if-eager/' },
  { name: 'IFERROR', category: 'Logical', guideUrl: 'https://dax.guide/iferror/' },
  { name: 'NOT', category: 'Logical', guideUrl: 'https://dax.guide/not/' },
  { name: 'OR', category: 'Logical', guideUrl: 'https://dax.guide/or/' },
  { name: 'SWITCH', category: 'Logical', guideUrl: 'https://dax.guide/switch/' },
  { name: 'TRUE', category: 'Logical', guideUrl: 'https://dax.guide/true/' },

  // ==========================================
  // MATH AND TRIG (51)
  // ==========================================
  { name: 'ABS', category: 'Math and Trig', guideUrl: 'https://dax.guide/abs/' },
  { name: 'ACOS', category: 'Math and Trig', guideUrl: 'https://dax.guide/acos/' },
  { name: 'ACOSH', category: 'Math and Trig', guideUrl: 'https://dax.guide/acosh/' },
  { name: 'ACOT', category: 'Math and Trig', guideUrl: 'https://dax.guide/acot/' },
  { name: 'ACOTH', category: 'Math and Trig', guideUrl: 'https://dax.guide/acoth/' },
  { name: 'ASIN', category: 'Math and Trig', guideUrl: 'https://dax.guide/asin/' },
  { name: 'ASINH', category: 'Math and Trig', guideUrl: 'https://dax.guide/asinh/' },
  { name: 'ATAN', category: 'Math and Trig', guideUrl: 'https://dax.guide/atan/' },
  { name: 'ATANH', category: 'Math and Trig', guideUrl: 'https://dax.guide/atanh/' },
  { name: 'CEILING', category: 'Math and Trig', guideUrl: 'https://dax.guide/ceiling/' },
  { name: 'COMBIN', category: 'Math and Trig', guideUrl: 'https://dax.guide/combin/' },
  { name: 'COMBINA', category: 'Math and Trig', guideUrl: 'https://dax.guide/combina/' },
  { name: 'COS', category: 'Math and Trig', guideUrl: 'https://dax.guide/cos/' },
  { name: 'COSH', category: 'Math and Trig', guideUrl: 'https://dax.guide/cosh/' },
  { name: 'COT', category: 'Math and Trig', guideUrl: 'https://dax.guide/cot/' },
  { name: 'COTH', category: 'Math and Trig', guideUrl: 'https://dax.guide/coth/' },
  { name: 'CURRENCY', category: 'Math and Trig', guideUrl: 'https://dax.guide/currency/' },
  { name: 'DEGREES', category: 'Math and Trig', guideUrl: 'https://dax.guide/degrees/' },
  { name: 'DIVIDE', category: 'Math and Trig', guideUrl: 'https://dax.guide/divide/' },
  { name: 'EVEN', category: 'Math and Trig', guideUrl: 'https://dax.guide/even/' },
  { name: 'EXP', category: 'Math and Trig', guideUrl: 'https://dax.guide/exp/' },
  { name: 'FACT', category: 'Math and Trig', guideUrl: 'https://dax.guide/fact/' },
  { name: 'FLOOR', category: 'Math and Trig', guideUrl: 'https://dax.guide/floor/' },
  { name: 'GCD', category: 'Math and Trig', guideUrl: 'https://dax.guide/gcd/' },
  { name: 'INT', category: 'Math and Trig', guideUrl: 'https://dax.guide/int/' },
  { name: 'ISO.CEILING', category: 'Math and Trig', guideUrl: 'https://dax.guide/iso-ceiling/' },
  { name: 'LCM', category: 'Math and Trig', guideUrl: 'https://dax.guide/lcm/' },
  { name: 'LN', category: 'Math and Trig', guideUrl: 'https://dax.guide/ln/' },
  { name: 'LOG', category: 'Math and Trig', guideUrl: 'https://dax.guide/log/' },
  { name: 'LOG10', category: 'Math and Trig', guideUrl: 'https://dax.guide/log10/' },
  { name: 'MOD', category: 'Math and Trig', guideUrl: 'https://dax.guide/mod/' },
  { name: 'MROUND', category: 'Math and Trig', guideUrl: 'https://dax.guide/mround/' },
  { name: 'ODD', category: 'Math and Trig', guideUrl: 'https://dax.guide/odd/' },
  { name: 'PERMUT', category: 'Math and Trig', guideUrl: 'https://dax.guide/permut/' },
  { name: 'PI', category: 'Math and Trig', guideUrl: 'https://dax.guide/pi/' },
  { name: 'POWER', category: 'Math and Trig', guideUrl: 'https://dax.guide/power/' },
  { name: 'QUOTIENT', category: 'Math and Trig', guideUrl: 'https://dax.guide/quotient/' },
  { name: 'RADIANS', category: 'Math and Trig', guideUrl: 'https://dax.guide/radians/' },
  { name: 'RAND', category: 'Math and Trig', guideUrl: 'https://dax.guide/rand/' },
  { name: 'RANDBETWEEN', category: 'Math and Trig', guideUrl: 'https://dax.guide/randbetween/' },
  { name: 'ROUND', category: 'Math and Trig', guideUrl: 'https://dax.guide/round/' },
  { name: 'ROUNDDOWN', category: 'Math and Trig', guideUrl: 'https://dax.guide/rounddown/' },
  { name: 'ROUNDUP', category: 'Math and Trig', guideUrl: 'https://dax.guide/roundup/' },
  { name: 'SIGN', category: 'Math and Trig', guideUrl: 'https://dax.guide/sign/' },
  { name: 'SIN', category: 'Math and Trig', guideUrl: 'https://dax.guide/sin/' },
  { name: 'SINH', category: 'Math and Trig', guideUrl: 'https://dax.guide/sinh/' },
  { name: 'SQRT', category: 'Math and Trig', guideUrl: 'https://dax.guide/sqrt/' },
  { name: 'SQRTPI', category: 'Math and Trig', guideUrl: 'https://dax.guide/sqrtpi/' },
  { name: 'TAN', category: 'Math and Trig', guideUrl: 'https://dax.guide/tan/' },
  { name: 'TANH', category: 'Math and Trig', guideUrl: 'https://dax.guide/tanh/' },
  { name: 'TRUNC', category: 'Math and Trig', guideUrl: 'https://dax.guide/trunc/' },

  // ==========================================
  // TEXT (25)
  // ==========================================
  { name: 'BLANK', category: 'Text', guideUrl: 'https://dax.guide/blank/' },
  { name: 'CHAR', category: 'Text', guideUrl: 'https://dax.guide/char/' },
  { name: 'CLEAN', category: 'Text', guideUrl: 'https://dax.guide/clean/' },
  { name: 'CODE', category: 'Text', guideUrl: 'https://dax.guide/code/' },
  { name: 'COMBINEVALUES', category: 'Text', guideUrl: 'https://dax.guide/combinevalues/' },
  { name: 'CONCATENATE', category: 'Text', guideUrl: 'https://dax.guide/concatenate/' },
  { name: 'CONCATENATEX', category: 'Text', guideUrl: 'https://dax.guide/concatenatex/' },
  { name: 'EXACT', category: 'Text', guideUrl: 'https://dax.guide/exact/' },
  { name: 'FIND', category: 'Text', guideUrl: 'https://dax.guide/find/' },
  { name: 'FIXED', category: 'Text', guideUrl: 'https://dax.guide/fixed/' },
  { name: 'FORMAT', category: 'Text', guideUrl: 'https://dax.guide/format/' },
  { name: 'LEFT', category: 'Text', guideUrl: 'https://dax.guide/left/' },
  { name: 'LEN', category: 'Text', guideUrl: 'https://dax.guide/len/' },
  { name: 'LOWER', category: 'Text', guideUrl: 'https://dax.guide/lower/' },
  { name: 'MID', category: 'Text', guideUrl: 'https://dax.guide/mid/' },
  { name: 'REPLACE', category: 'Text', guideUrl: 'https://dax.guide/replace/' },
  { name: 'REPT', category: 'Text', guideUrl: 'https://dax.guide/rept/' },
  { name: 'RIGHT', category: 'Text', guideUrl: 'https://dax.guide/right/' },
  { name: 'SEARCH', category: 'Text', guideUrl: 'https://dax.guide/search/' },
  { name: 'SUBSTITUTE', category: 'Text', guideUrl: 'https://dax.guide/substitute/' },
  { name: 'TRIM', category: 'Text', guideUrl: 'https://dax.guide/trim/' },
  { name: 'UNICHAR', category: 'Text', guideUrl: 'https://dax.guide/unichar/' },
  { name: 'UNICODE', category: 'Text', guideUrl: 'https://dax.guide/unicode/' },
  { name: 'UPPER', category: 'Text', guideUrl: 'https://dax.guide/upper/' },
  { name: 'VALUE', category: 'Text', guideUrl: 'https://dax.guide/value/' },

  // ==========================================
  // TABLE MANIPULATION (24)
  // ==========================================
  { name: 'ADDCOLUMNS', category: 'Table manipulation', guideUrl: 'https://dax.guide/addcolumns/' },
  { name: 'CROSSJOIN', category: 'Table manipulation', guideUrl: 'https://dax.guide/crossjoin/' },
  { name: 'CURRENTGROUP', category: 'Table manipulation', guideUrl: 'https://dax.guide/currentgroup/' },
  { name: 'DATATABLE', category: 'Table manipulation', guideUrl: 'https://dax.guide/datatable/' },
  { name: 'DISTINCT', category: 'Table manipulation', guideUrl: 'https://dax.guide/distinct/' },
  { name: 'EXCEPT', category: 'Table manipulation', guideUrl: 'https://dax.guide/except/' },
  { name: 'FILTERS', category: 'Table manipulation', guideUrl: 'https://dax.guide/filters/' },
  { name: 'GENERATE', category: 'Table manipulation', guideUrl: 'https://dax.guide/generate/' },
  { name: 'GENERATEALL', category: 'Table manipulation', guideUrl: 'https://dax.guide/generateall/' },
  { name: 'GROUPBY', category: 'Table manipulation', guideUrl: 'https://dax.guide/groupby/' },
  { name: 'INTERSECT', category: 'Table manipulation', guideUrl: 'https://dax.guide/intersect/' },
  { name: 'NATURALINNERJOIN', category: 'Table manipulation', guideUrl: 'https://dax.guide/naturalinnerjoin/' },
  { name: 'NATURALLEFTOUTERJOIN', category: 'Table manipulation', guideUrl: 'https://dax.guide/naturalleftouterjoin/' },
  { name: 'ROW', category: 'Table manipulation', guideUrl: 'https://dax.guide/row/' },
  { name: 'SELECTCOLUMNS', category: 'Table manipulation', guideUrl: 'https://dax.guide/selectcolumns/' },
  { name: 'SUBSTITUTEWITHINDEX', category: 'Table manipulation', guideUrl: 'https://dax.guide/substitutewithindex/' },
  { name: 'SUMMARIZE', category: 'Table manipulation', guideUrl: 'https://dax.guide/summarize/' },
  { name: 'SUMMARIZECOLUMNS', category: 'Table manipulation', guideUrl: 'https://dax.guide/summarizecolumns/' },
  { name: 'TOPN', category: 'Table manipulation', guideUrl: 'https://dax.guide/topn/' },
  { name: 'TREATAS', category: 'Table manipulation', guideUrl: 'https://dax.guide/treatas/' },
  { name: 'UNION', category: 'Table manipulation', guideUrl: 'https://dax.guide/union/' },
  { name: 'VALUES', category: 'Table manipulation', guideUrl: 'https://dax.guide/values/' },

  // ==========================================
  // RELATIONSHIP (4)
  // ==========================================
  { name: 'CROSSFILTER', category: 'Relationship', guideUrl: 'https://dax.guide/crossfilter/' },
  { name: 'RELATED', category: 'Relationship', guideUrl: 'https://dax.guide/related/' },
  { name: 'RELATEDTABLE', category: 'Relationship', guideUrl: 'https://dax.guide/relatedtable/' },
  { name: 'USERELATIONSHIP', category: 'Relationship', guideUrl: 'https://dax.guide/userelationship/' },

  // ==========================================
  // PARENT-CHILD (5)
  // ==========================================
  { name: 'PATH', category: 'Parent-Child', guideUrl: 'https://dax.guide/path/' },
  { name: 'PATHCONTAINS', category: 'Parent-Child', guideUrl: 'https://dax.guide/pathcontains/' },
  { name: 'PATHITEM', category: 'Parent-Child', guideUrl: 'https://dax.guide/pathitem/' },
  { name: 'PATHITEMREVERSE', category: 'Parent-Child', guideUrl: 'https://dax.guide/pathitemreverse/' },
  { name: 'PATHLENGTH', category: 'Parent-Child', guideUrl: 'https://dax.guide/pathlength/' },

  // ==========================================
  // WINDOW AND RANKING (6)
  // ==========================================
  { name: 'INDEX', category: 'Window and Ranking', guideUrl: 'https://dax.guide/index/' },
  { name: 'OFFSET', category: 'Window and Ranking', guideUrl: 'https://dax.guide/offset/' },
  { name: 'RANK', category: 'Window and Ranking', guideUrl: 'https://dax.guide/rank/' },
  { name: 'RANKX', category: 'Window and Ranking', guideUrl: 'https://dax.guide/rankx/' },
  { name: 'ROWNUMBER', category: 'Window and Ranking', guideUrl: 'https://dax.guide/rownumber/' },
  { name: 'WINDOW', category: 'Window and Ranking', guideUrl: 'https://dax.guide/window/' },

  // ==========================================
  // VISUAL CALCULATIONS (10)
  // ==========================================
  { name: 'COLLAPSE', category: 'Visual Calculations', guideUrl: 'https://dax.guide/collapse/' },
  { name: 'COLLAPSEALL', category: 'Visual Calculations', guideUrl: 'https://dax.guide/collapseall/' },
  { name: 'EXPAND', category: 'Visual Calculations', guideUrl: 'https://dax.guide/expand/' },
  { name: 'EXPANDALL', category: 'Visual Calculations', guideUrl: 'https://dax.guide/expandall/' },
  { name: 'FIRST', category: 'Visual Calculations', guideUrl: 'https://dax.guide/first/' },
  { name: 'LAST', category: 'Visual Calculations', guideUrl: 'https://dax.guide/last/' },
  { name: 'MOVINGAVERAGE', category: 'Visual Calculations', guideUrl: 'https://dax.guide/movingaverage/' },
  { name: 'NEXT', category: 'Visual Calculations', guideUrl: 'https://dax.guide/next/' },
  { name: 'PREVIOUS', category: 'Visual Calculations', guideUrl: 'https://dax.guide/previous/' },
  { name: 'RUNNINGSUM', category: 'Visual Calculations', guideUrl: 'https://dax.guide/runningsum/' },

  // ==========================================
  // CALCULATION GROUPS (4)
  // ==========================================
  { name: 'ISSELECTEDMEASURE', category: 'Calculation Groups', guideUrl: 'https://dax.guide/isselectedmeasure/' },
  { name: 'SELECTEDMEASURE', category: 'Calculation Groups', guideUrl: 'https://dax.guide/selectedmeasure/' },
  { name: 'SELECTEDMEASUREFORMATSTRING', category: 'Calculation Groups', guideUrl: 'https://dax.guide/selectedmeasureformatstring/' },
  { name: 'SELECTEDMEASURENAME', category: 'Calculation Groups', guideUrl: 'https://dax.guide/selectedmeasurename/' },

  // ==========================================
  // STATISTICAL (44)
  // ==========================================
  { name: 'BETA.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/beta-dist/' },
  { name: 'BETA.INV', category: 'Statistical', guideUrl: 'https://dax.guide/beta-inv/' },
  { name: 'CHISQ.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/chisq-dist/' },
  { name: 'CHISQ.DIST.RT', category: 'Statistical', guideUrl: 'https://dax.guide/chisq-dist-rt/' },
  { name: 'CHISQ.INV', category: 'Statistical', guideUrl: 'https://dax.guide/chisq-inv/' },
  { name: 'CHISQ.INV.RT', category: 'Statistical', guideUrl: 'https://dax.guide/chisq-inv-rt/' },
  { name: 'CONFIDENCE.NORM', category: 'Statistical', guideUrl: 'https://dax.guide/confidence-norm/' },
  { name: 'CONFIDENCE.T', category: 'Statistical', guideUrl: 'https://dax.guide/confidence-t/' },
  { name: 'EXPON.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/expon-dist/' },
  { name: 'F.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/f-dist/' },
  { name: 'F.DIST.RT', category: 'Statistical', guideUrl: 'https://dax.guide/f-dist-rt/' },
  { name: 'F.INV', category: 'Statistical', guideUrl: 'https://dax.guide/f-inv/' },
  { name: 'F.INV.RT', category: 'Statistical', guideUrl: 'https://dax.guide/f-inv-rt/' },
  { name: 'GAMMA.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/gamma-dist/' },
  { name: 'GAMMA.INV', category: 'Statistical', guideUrl: 'https://dax.guide/gamma-inv/' },
  { name: 'GAMMALN', category: 'Statistical', guideUrl: 'https://dax.guide/gammaln/' },
  { name: 'GEOMEAN', category: 'Statistical', guideUrl: 'https://dax.guide/geomean/' },
  { name: 'GEOMEANX', category: 'Statistical', guideUrl: 'https://dax.guide/geomeanx/' },
  { name: 'LINEST', category: 'Statistical', guideUrl: 'https://dax.guide/linest/' },
  { name: 'LINESTX', category: 'Statistical', guideUrl: 'https://dax.guide/linestx/' },
  { name: 'LOGNORM.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/lognorm-dist/' },
  { name: 'LOGNORM.INV', category: 'Statistical', guideUrl: 'https://dax.guide/lognorm-inv/' },
  { name: 'NORM.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/norm-dist/' },
  { name: 'NORM.INV', category: 'Statistical', guideUrl: 'https://dax.guide/norm-inv/' },
  { name: 'NORM.S.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/norm-s-dist/' },
  { name: 'NORM.S.INV', category: 'Statistical', guideUrl: 'https://dax.guide/norm-s-inv/' },
  { name: 'POISSON.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/poisson-dist/' },
  { name: 'RANK.EQ', category: 'Statistical', guideUrl: 'https://dax.guide/rank-eq/' },
  { name: 'SAMPLE', category: 'Statistical', guideUrl: 'https://dax.guide/sample/' },
  { name: 'STDEV.P', category: 'Statistical', guideUrl: 'https://dax.guide/stdev-p/' },
  { name: 'STDEV.S', category: 'Statistical', guideUrl: 'https://dax.guide/stdev-s/' },
  { name: 'STDEVX.P', category: 'Statistical', guideUrl: 'https://dax.guide/stdevx-p/' },
  { name: 'STDEVX.S', category: 'Statistical', guideUrl: 'https://dax.guide/stdevx-s/' },
  { name: 'T.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/t-dist/' },
  { name: 'T.DIST.2T', category: 'Statistical', guideUrl: 'https://dax.guide/t-dist-2t/' },
  { name: 'T.DIST.RT', category: 'Statistical', guideUrl: 'https://dax.guide/t-dist-rt/' },
  { name: 'T.INV', category: 'Statistical', guideUrl: 'https://dax.guide/t-inv/' },
  { name: 'T.INV.2T', category: 'Statistical', guideUrl: 'https://dax.guide/t-inv-2t/' },
  { name: 'VAR.P', category: 'Statistical', guideUrl: 'https://dax.guide/var-p/' },
  { name: 'VAR.S', category: 'Statistical', guideUrl: 'https://dax.guide/var-s/' },
  { name: 'VARX.P', category: 'Statistical', guideUrl: 'https://dax.guide/varx-p/' },
  { name: 'VARX.S', category: 'Statistical', guideUrl: 'https://dax.guide/varx-s/' },
  { name: 'WEIBULL.DIST', category: 'Statistical', guideUrl: 'https://dax.guide/weibull-dist/' },

  // ==========================================
  // FINANCIAL (52)
  // ==========================================
  { name: 'ACCRINT', category: 'Financial', guideUrl: 'https://dax.guide/accrint/' },
  { name: 'ACCRINTM', category: 'Financial', guideUrl: 'https://dax.guide/accrintm/' },
  { name: 'AMORDEGRC', category: 'Financial', guideUrl: 'https://dax.guide/amordegrc/' },
  { name: 'AMORLINC', category: 'Financial', guideUrl: 'https://dax.guide/amorlinc/' },
  { name: 'COUPDAYBS', category: 'Financial', guideUrl: 'https://dax.guide/coupdaybs/' },
  { name: 'COUPDAYS', category: 'Financial', guideUrl: 'https://dax.guide/coupdays/' },
  { name: 'COUPDAYSNC', category: 'Financial', guideUrl: 'https://dax.guide/coupdaysnc/' },
  { name: 'COUPNCD', category: 'Financial', guideUrl: 'https://dax.guide/coupncd/' },
  { name: 'COUPNUM', category: 'Financial', guideUrl: 'https://dax.guide/coupnum/' },
  { name: 'COUPPCD', category: 'Financial', guideUrl: 'https://dax.guide/couppcd/' },
  { name: 'CUMIPMT', category: 'Financial', guideUrl: 'https://dax.guide/cumipmt/' },
  { name: 'CUMPRINC', category: 'Financial', guideUrl: 'https://dax.guide/cumprinc/' },
  { name: 'DB', category: 'Financial', guideUrl: 'https://dax.guide/db/' },
  { name: 'DDB', category: 'Financial', guideUrl: 'https://dax.guide/ddb/' },
  { name: 'DISC', category: 'Financial', guideUrl: 'https://dax.guide/disc/' },
  { name: 'DOLLARDE', category: 'Financial', guideUrl: 'https://dax.guide/dollarde/' },
  { name: 'DOLLARFR', category: 'Financial', guideUrl: 'https://dax.guide/dollarfr/' },
  { name: 'DURATION', category: 'Financial', guideUrl: 'https://dax.guide/duration/' },
  { name: 'EFFECT', category: 'Financial', guideUrl: 'https://dax.guide/effect/' },
  { name: 'FV', category: 'Financial', guideUrl: 'https://dax.guide/fv/' },
  { name: 'FVSCHEDULE', category: 'Financial', guideUrl: 'https://dax.guide/fvschedule/' },
  { name: 'INTRATE', category: 'Financial', guideUrl: 'https://dax.guide/intrate/' },
  { name: 'IPMT', category: 'Financial', guideUrl: 'https://dax.guide/ipmt/' },
  { name: 'IRR', category: 'Financial', guideUrl: 'https://dax.guide/irr/' },
  { name: 'ISPMT', category: 'Financial', guideUrl: 'https://dax.guide/ispmt/' },
  { name: 'MDURATION', category: 'Financial', guideUrl: 'https://dax.guide/mduration/' },
  { name: 'MIRR', category: 'Financial', guideUrl: 'https://dax.guide/mirr/' },
  { name: 'NOMINAL', category: 'Financial', guideUrl: 'https://dax.guide/nominal/' },
  { name: 'NPER', category: 'Financial', guideUrl: 'https://dax.guide/nper/' },
  { name: 'NPV', category: 'Financial', guideUrl: 'https://dax.guide/npv/' },
  { name: 'ODDFPRICE', category: 'Financial', guideUrl: 'https://dax.guide/oddfprice/' },
  { name: 'ODDFYIELD', category: 'Financial', guideUrl: 'https://dax.guide/oddfyield/' },
  { name: 'ODDLPRICE', category: 'Financial', guideUrl: 'https://dax.guide/oddlprice/' },
  { name: 'ODDLYIELD', category: 'Financial', guideUrl: 'https://dax.guide/oddlyield/' },
  { name: 'PDURATION', category: 'Financial', guideUrl: 'https://dax.guide/pduration/' },
  { name: 'PMT', category: 'Financial', guideUrl: 'https://dax.guide/pmt/' },
  { name: 'PPMT', category: 'Financial', guideUrl: 'https://dax.guide/ppmt/' },
  { name: 'PRICE', category: 'Financial', guideUrl: 'https://dax.guide/price/' },
  { name: 'PRICEDISC', category: 'Financial', guideUrl: 'https://dax.guide/pricedisc/' },
  { name: 'PRICEMAT', category: 'Financial', guideUrl: 'https://dax.guide/pricemat/' },
  { name: 'PV', category: 'Financial', guideUrl: 'https://dax.guide/pv/' },
  { name: 'RATE', category: 'Financial', guideUrl: 'https://dax.guide/rate/' },
  { name: 'RECEIVED', category: 'Financial', guideUrl: 'https://dax.guide/received/' },
  { name: 'RRI', category: 'Financial', guideUrl: 'https://dax.guide/rri/' },
  { name: 'SLN', category: 'Financial', guideUrl: 'https://dax.guide/sln/' },
  { name: 'SYD', category: 'Financial', guideUrl: 'https://dax.guide/syd/' },
  { name: 'TBILLEQ', category: 'Financial', guideUrl: 'https://dax.guide/tbilleq/' },
  { name: 'TBILLPRICE', category: 'Financial', guideUrl: 'https://dax.guide/tbillprice/' },
  { name: 'TBILLYIELD', category: 'Financial', guideUrl: 'https://dax.guide/tbillyield/' },
  { name: 'VDB', category: 'Financial', guideUrl: 'https://dax.guide/vdb/' },
  { name: 'XIRR', category: 'Financial', guideUrl: 'https://dax.guide/xirr/' },
  { name: 'XNPV', category: 'Financial', guideUrl: 'https://dax.guide/xnpv/' },
  { name: 'YIELD', category: 'Financial', guideUrl: 'https://dax.guide/yield/' },
  { name: 'YIELDDISC', category: 'Financial', guideUrl: 'https://dax.guide/yielddisc/' },
  { name: 'YIELDMAT', category: 'Financial', guideUrl: 'https://dax.guide/yieldmat/' },

  // ==========================================
  // UTILITY & METADATA (6)
  // ==========================================
  { name: 'COLUMNSTATISTICS', category: 'Utility', guideUrl: 'https://dax.guide/columnstatistics/' },
  { name: 'ERROR', category: 'Utility', guideUrl: 'https://dax.guide/error/' },
  { name: 'EVALUATEANDLOG', category: 'Utility', guideUrl: 'https://dax.guide/evaluateandlog/' },
  { name: 'HASH', category: 'Utility', guideUrl: 'https://dax.guide/hash/' },
  { name: 'TOCSV', category: 'Utility', guideUrl: 'https://dax.guide/tocsv/' },
  { name: 'TOJSON', category: 'Utility', guideUrl: 'https://dax.guide/tojson/' },
];

export const TOTAL_DAX_GUIDE_FUNCTIONS = DAX_GUIDE_INDEX.length;
