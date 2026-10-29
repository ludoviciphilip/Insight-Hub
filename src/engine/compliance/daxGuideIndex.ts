/**
 * Canonical index of all official functions in DAX Guide (https://dax.guide/)
 * Fetched live on 2026-10-29 from the official dax.guide directory.
 * Total canonical functions: 484.
 */

export const DAX_GUIDE_INDEX_FETCHED_AT = "2026-10-29";

export interface DaxGuideEntry {
  name: string;
  category:
    | "Aggregation"
    | "Date and Time"
    | "Filter"
    | "Financial"
    | "Information"
    | "Logical"
    | "Math and Trig"
    | "Other"
    | "Parent-Child"
    | "Relationship"
    | "Statistical"
    | "Table manipulation"
    | "Text"
    | "Time Intelligence"
    | "Visual Calculations"
    | "Implementadas fora do índice";
  guideUrl: string;
}

export const DAX_GUIDE_INDEX: DaxGuideEntry[] = [
  {
    "name": "APPROXIMATEDISTINCTCOUNT",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/approximatedistinctcount/"
  },
  {
    "name": "AVERAGE",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/average/"
  },
  {
    "name": "AVERAGEA",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/averagea/"
  },
  {
    "name": "AVERAGEX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/averagex/"
  },
  {
    "name": "COUNT",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/count/"
  },
  {
    "name": "COUNTA",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/counta/"
  },
  {
    "name": "COUNTAX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/countax/"
  },
  {
    "name": "COUNTBLANK",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/countblank/"
  },
  {
    "name": "COUNTROWS",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/countrows/"
  },
  {
    "name": "COUNTX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/countx/"
  },
  {
    "name": "DISTINCTCOUNT",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/distinctcount/"
  },
  {
    "name": "DISTINCTCOUNTNOBLANK",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/distinctcountnoblank/"
  },
  {
    "name": "MAX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/max/"
  },
  {
    "name": "MAXA",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/maxa/"
  },
  {
    "name": "MAXX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/maxx/"
  },
  {
    "name": "MIN",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/min/"
  },
  {
    "name": "MINA",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/mina/"
  },
  {
    "name": "MINX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/minx/"
  },
  {
    "name": "PRODUCT",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/product/"
  },
  {
    "name": "PRODUCTX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/productx/"
  },
  {
    "name": "SUM",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/sum/"
  },
  {
    "name": "SUMX",
    "category": "Aggregation",
    "guideUrl": "https://dax.guide/sumx/"
  },
  {
    "name": "CALENDAR",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/calendar/"
  },
  {
    "name": "CALENDARAUTO",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/calendarauto/"
  },
  {
    "name": "DATE",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/date/"
  },
  {
    "name": "DATEDIFF",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/datediff/"
  },
  {
    "name": "DATEVALUE",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/datevalue/"
  },
  {
    "name": "DAY",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/day/"
  },
  {
    "name": "EDATE",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/edate/"
  },
  {
    "name": "EOMONTH",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/eomonth/"
  },
  {
    "name": "HOUR",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/hour/"
  },
  {
    "name": "MINUTE",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/minute/"
  },
  {
    "name": "MONTH",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/month/"
  },
  {
    "name": "NETWORKDAYS",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/networkdays/"
  },
  {
    "name": "NOW",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/now/"
  },
  {
    "name": "QUARTER",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/quarter/"
  },
  {
    "name": "SECOND",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/second/"
  },
  {
    "name": "TIME",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/time/"
  },
  {
    "name": "TIMEVALUE",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/timevalue/"
  },
  {
    "name": "TODAY",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/today/"
  },
  {
    "name": "UTCNOW",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/utcnow/"
  },
  {
    "name": "UTCTODAY",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/utctoday/"
  },
  {
    "name": "WEEKDAY",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/weekday/"
  },
  {
    "name": "WEEKNUM",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/weeknum/"
  },
  {
    "name": "YEAR",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/year/"
  },
  {
    "name": "YEARFRAC",
    "category": "Date and Time",
    "guideUrl": "https://dax.guide/yearfrac/"
  },
  {
    "name": "ALL",
    "category": "Filter",
    "guideUrl": "https://dax.guide/all/"
  },
  {
    "name": "ALLCROSSFILTERED",
    "category": "Filter",
    "guideUrl": "https://dax.guide/allcrossfiltered/"
  },
  {
    "name": "ALLEXCEPT",
    "category": "Filter",
    "guideUrl": "https://dax.guide/allexcept/"
  },
  {
    "name": "ALLNOBLANKROW",
    "category": "Filter",
    "guideUrl": "https://dax.guide/allnoblankrow/"
  },
  {
    "name": "ALLSELECTED",
    "category": "Filter",
    "guideUrl": "https://dax.guide/allselected/"
  },
  {
    "name": "ALLSELECTEDAPPLY",
    "category": "Filter",
    "guideUrl": "https://dax.guide/allselectedapply/"
  },
  {
    "name": "ALLSELECTEDREMOVE",
    "category": "Filter",
    "guideUrl": "https://dax.guide/allselectedremove/"
  },
  {
    "name": "ALWAYSAPPLY",
    "category": "Filter",
    "guideUrl": "https://dax.guide/alwaysapply/"
  },
  {
    "name": "CALCULATE",
    "category": "Filter",
    "guideUrl": "https://dax.guide/calculate/"
  },
  {
    "name": "CALCULATETABLE",
    "category": "Filter",
    "guideUrl": "https://dax.guide/calculatetable/"
  },
  {
    "name": "DEPENDON",
    "category": "Filter",
    "guideUrl": "https://dax.guide/dependon/"
  },
  {
    "name": "FILTER",
    "category": "Filter",
    "guideUrl": "https://dax.guide/filter/"
  },
  {
    "name": "FILTERCLUSTER",
    "category": "Filter",
    "guideUrl": "https://dax.guide/filtercluster/"
  },
  {
    "name": "GROUPCROSSAPPLY",
    "category": "Filter",
    "guideUrl": "https://dax.guide/groupcrossapply/"
  },
  {
    "name": "GROUPCROSSAPPLYTABLE",
    "category": "Filter",
    "guideUrl": "https://dax.guide/groupcrossapplytable/"
  },
  {
    "name": "INDEX",
    "category": "Filter",
    "guideUrl": "https://dax.guide/index/"
  },
  {
    "name": "KEEPFILTERS",
    "category": "Filter",
    "guideUrl": "https://dax.guide/keepfilters/"
  },
  {
    "name": "LOOKUP",
    "category": "Filter",
    "guideUrl": "https://dax.guide/lookup/"
  },
  {
    "name": "LOOKUPVALUE",
    "category": "Filter",
    "guideUrl": "https://dax.guide/lookupvalue/"
  },
  {
    "name": "LOOKUPWITHTOTALS",
    "category": "Filter",
    "guideUrl": "https://dax.guide/lookupwithtotals/"
  },
  {
    "name": "MATCHBY",
    "category": "Filter",
    "guideUrl": "https://dax.guide/matchby/"
  },
  {
    "name": "NONFILTER",
    "category": "Filter",
    "guideUrl": "https://dax.guide/nonfilter/"
  },
  {
    "name": "OFFSET",
    "category": "Filter",
    "guideUrl": "https://dax.guide/offset/"
  },
  {
    "name": "ORDERBY",
    "category": "Filter",
    "guideUrl": "https://dax.guide/orderby/"
  },
  {
    "name": "PARTITIONBY",
    "category": "Filter",
    "guideUrl": "https://dax.guide/partitionby/"
  },
  {
    "name": "REMOVEFILTERS",
    "category": "Filter",
    "guideUrl": "https://dax.guide/removefilters/"
  },
  {
    "name": "SELECTEDVALUE",
    "category": "Filter",
    "guideUrl": "https://dax.guide/selectedvalue/"
  },
  {
    "name": "SHADOWCLUSTER",
    "category": "Filter",
    "guideUrl": "https://dax.guide/shadowcluster/"
  },
  {
    "name": "WINDOW",
    "category": "Filter",
    "guideUrl": "https://dax.guide/window/"
  },
  {
    "name": "ACCRINT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/accrint/"
  },
  {
    "name": "ACCRINTM",
    "category": "Financial",
    "guideUrl": "https://dax.guide/accrintm/"
  },
  {
    "name": "AMORDEGRC",
    "category": "Financial",
    "guideUrl": "https://dax.guide/amordegrc/"
  },
  {
    "name": "AMORLINC",
    "category": "Financial",
    "guideUrl": "https://dax.guide/amorlinc/"
  },
  {
    "name": "COUPDAYBS",
    "category": "Financial",
    "guideUrl": "https://dax.guide/coupdaybs/"
  },
  {
    "name": "COUPDAYS",
    "category": "Financial",
    "guideUrl": "https://dax.guide/coupdays/"
  },
  {
    "name": "COUPDAYSNC",
    "category": "Financial",
    "guideUrl": "https://dax.guide/coupdaysnc/"
  },
  {
    "name": "COUPNCD",
    "category": "Financial",
    "guideUrl": "https://dax.guide/coupncd/"
  },
  {
    "name": "COUPNUM",
    "category": "Financial",
    "guideUrl": "https://dax.guide/coupnum/"
  },
  {
    "name": "COUPPCD",
    "category": "Financial",
    "guideUrl": "https://dax.guide/couppcd/"
  },
  {
    "name": "CUMIPMT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/cumipmt/"
  },
  {
    "name": "CUMPRINC",
    "category": "Financial",
    "guideUrl": "https://dax.guide/cumprinc/"
  },
  {
    "name": "DB",
    "category": "Financial",
    "guideUrl": "https://dax.guide/db/"
  },
  {
    "name": "DDB",
    "category": "Financial",
    "guideUrl": "https://dax.guide/ddb/"
  },
  {
    "name": "DISC",
    "category": "Financial",
    "guideUrl": "https://dax.guide/disc/"
  },
  {
    "name": "DOLLARDE",
    "category": "Financial",
    "guideUrl": "https://dax.guide/dollarde/"
  },
  {
    "name": "DOLLARFR",
    "category": "Financial",
    "guideUrl": "https://dax.guide/dollarfr/"
  },
  {
    "name": "DURATION",
    "category": "Financial",
    "guideUrl": "https://dax.guide/duration/"
  },
  {
    "name": "EFFECT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/effect/"
  },
  {
    "name": "FV",
    "category": "Financial",
    "guideUrl": "https://dax.guide/fv/"
  },
  {
    "name": "INTRATE",
    "category": "Financial",
    "guideUrl": "https://dax.guide/intrate/"
  },
  {
    "name": "IPMT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/ipmt/"
  },
  {
    "name": "ISPMT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/ispmt/"
  },
  {
    "name": "MDURATION",
    "category": "Financial",
    "guideUrl": "https://dax.guide/mduration/"
  },
  {
    "name": "NOMINAL",
    "category": "Financial",
    "guideUrl": "https://dax.guide/nominal/"
  },
  {
    "name": "NPER",
    "category": "Financial",
    "guideUrl": "https://dax.guide/nper/"
  },
  {
    "name": "ODDFPRICE",
    "category": "Financial",
    "guideUrl": "https://dax.guide/oddfprice/"
  },
  {
    "name": "ODDFYIELD",
    "category": "Financial",
    "guideUrl": "https://dax.guide/oddfyield/"
  },
  {
    "name": "ODDLPRICE",
    "category": "Financial",
    "guideUrl": "https://dax.guide/oddlprice/"
  },
  {
    "name": "ODDLYIELD",
    "category": "Financial",
    "guideUrl": "https://dax.guide/oddlyield/"
  },
  {
    "name": "PDURATION",
    "category": "Financial",
    "guideUrl": "https://dax.guide/pduration/"
  },
  {
    "name": "PMT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/pmt/"
  },
  {
    "name": "PPMT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/ppmt/"
  },
  {
    "name": "PRICE",
    "category": "Financial",
    "guideUrl": "https://dax.guide/price/"
  },
  {
    "name": "PRICEDISC",
    "category": "Financial",
    "guideUrl": "https://dax.guide/pricedisc/"
  },
  {
    "name": "PRICEMAT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/pricemat/"
  },
  {
    "name": "PV",
    "category": "Financial",
    "guideUrl": "https://dax.guide/pv/"
  },
  {
    "name": "RATE",
    "category": "Financial",
    "guideUrl": "https://dax.guide/rate/"
  },
  {
    "name": "RECEIVED",
    "category": "Financial",
    "guideUrl": "https://dax.guide/received/"
  },
  {
    "name": "RRI",
    "category": "Financial",
    "guideUrl": "https://dax.guide/rri/"
  },
  {
    "name": "SLN",
    "category": "Financial",
    "guideUrl": "https://dax.guide/sln/"
  },
  {
    "name": "SYD",
    "category": "Financial",
    "guideUrl": "https://dax.guide/syd/"
  },
  {
    "name": "TBILLEQ",
    "category": "Financial",
    "guideUrl": "https://dax.guide/tbilleq/"
  },
  {
    "name": "TBILLPRICE",
    "category": "Financial",
    "guideUrl": "https://dax.guide/tbillprice/"
  },
  {
    "name": "TBILLYIELD",
    "category": "Financial",
    "guideUrl": "https://dax.guide/tbillyield/"
  },
  {
    "name": "VDB",
    "category": "Financial",
    "guideUrl": "https://dax.guide/vdb/"
  },
  {
    "name": "XIRR",
    "category": "Financial",
    "guideUrl": "https://dax.guide/xirr/"
  },
  {
    "name": "XNPV",
    "category": "Financial",
    "guideUrl": "https://dax.guide/xnpv/"
  },
  {
    "name": "YIELD",
    "category": "Financial",
    "guideUrl": "https://dax.guide/yield/"
  },
  {
    "name": "YIELDDISC",
    "category": "Financial",
    "guideUrl": "https://dax.guide/yielddisc/"
  },
  {
    "name": "YIELDMAT",
    "category": "Financial",
    "guideUrl": "https://dax.guide/yieldmat/"
  },
  {
    "name": "COLUMNSTATISTICS",
    "category": "Information",
    "guideUrl": "https://dax.guide/columnstatistics/"
  },
  {
    "name": "CONTAINS",
    "category": "Information",
    "guideUrl": "https://dax.guide/contains/"
  },
  {
    "name": "CONTAINSROW",
    "category": "Information",
    "guideUrl": "https://dax.guide/containsrow/"
  },
  {
    "name": "CONTAINSSTRING",
    "category": "Information",
    "guideUrl": "https://dax.guide/containsstring/"
  },
  {
    "name": "CONTAINSSTRINGEXACT",
    "category": "Information",
    "guideUrl": "https://dax.guide/containsstringexact/"
  },
  {
    "name": "CUSTOMDATA",
    "category": "Information",
    "guideUrl": "https://dax.guide/customdata/"
  },
  {
    "name": "EVALUATEANDLOG",
    "category": "Information",
    "guideUrl": "https://dax.guide/evaluateandlog/"
  },
  {
    "name": "HASONEFILTER",
    "category": "Information",
    "guideUrl": "https://dax.guide/hasonefilter/"
  },
  {
    "name": "HASONEVALUE",
    "category": "Information",
    "guideUrl": "https://dax.guide/hasonevalue/"
  },
  {
    "name": "INFO.ALTERNATEOFDEFINITIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-alternateofdefinitions/"
  },
  {
    "name": "INFO.ANNOTATIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-annotations/"
  },
  {
    "name": "INFO.ATTRIBUTEHIERARCHIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-attributehierarchies/"
  },
  {
    "name": "INFO.ATTRIBUTEHIERARCHYSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-attributehierarchystorages/"
  },
  {
    "name": "INFO.CALCDEPENDENCY",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-calcdependency/"
  },
  {
    "name": "INFO.CALCULATIONGROUPS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-calculationgroups/"
  },
  {
    "name": "INFO.CALCULATIONITEMS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-calculationitems/"
  },
  {
    "name": "INFO.CALENDARCOLUMNGROUPS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-calendarcolumngroups/"
  },
  {
    "name": "INFO.CALENDARCOLUMNREFERENCES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-calendarcolumnreferences/"
  },
  {
    "name": "INFO.CALENDARS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-calendars/"
  },
  {
    "name": "INFO.CATALOGS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-catalogs/"
  },
  {
    "name": "INFO.CHANGEDPROPERTIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-changedproperties/"
  },
  {
    "name": "INFO.COLUMNPARTITIONSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-columnpartitionstorages/"
  },
  {
    "name": "INFO.COLUMNPERMISSIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-columnpermissions/"
  },
  {
    "name": "INFO.COLUMNS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-columns/"
  },
  {
    "name": "INFO.COLUMNSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-columnstorages/"
  },
  {
    "name": "INFO.CSDLMETADATA",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-csdlmetadata/"
  },
  {
    "name": "INFO.CULTURES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-cultures/"
  },
  {
    "name": "INFO.DATACOVERAGEDEFINITIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-datacoveragedefinitions/"
  },
  {
    "name": "INFO.DATASOURCES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-datasources/"
  },
  {
    "name": "INFO.DELTATABLEMETADATASTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-deltatablemetadatastorages/"
  },
  {
    "name": "INFO.DEPENDENCIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-dependencies/"
  },
  {
    "name": "INFO.DETAILROWSDEFINITIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-detailrowsdefinitions/"
  },
  {
    "name": "INFO.DICTIONARYSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-dictionarystorages/"
  },
  {
    "name": "INFO.EXCLUDEDARTIFACTS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-excludedartifacts/"
  },
  {
    "name": "INFO.EXPRESSIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-expressions/"
  },
  {
    "name": "INFO.EXTENDEDPROPERTIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-extendedproperties/"
  },
  {
    "name": "INFO.FORMATSTRINGDEFINITIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-formatstringdefinitions/"
  },
  {
    "name": "INFO.FUNCTIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-functions/"
  },
  {
    "name": "INFO.GENERALSEGMENTMAPSEGMENTMETADATASTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-generalsegmentmapsegmentmetadatastorages/"
  },
  {
    "name": "INFO.GROUPBYCOLUMNS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-groupbycolumns/"
  },
  {
    "name": "INFO.HIERARCHIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-hierarchies/"
  },
  {
    "name": "INFO.HIERARCHYSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-hierarchystorages/"
  },
  {
    "name": "INFO.KPIS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-kpis/"
  },
  {
    "name": "INFO.LEVELS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-levels/"
  },
  {
    "name": "INFO.LINGUISTICMETADATA",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-linguisticmetadata/"
  },
  {
    "name": "INFO.MEASURES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-measures/"
  },
  {
    "name": "INFO.MODEL",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-model/"
  },
  {
    "name": "INFO.OBJECTTRANSLATIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-objecttranslations/"
  },
  {
    "name": "INFO.PARQUETFILESTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-parquetfilestorages/"
  },
  {
    "name": "INFO.PARTITIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-partitions/"
  },
  {
    "name": "INFO.PARTITIONSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-partitionstorages/"
  },
  {
    "name": "INFO.PERSPECTIVECOLUMNS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-perspectivecolumns/"
  },
  {
    "name": "INFO.PERSPECTIVEHIERARCHIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-perspectivehierarchies/"
  },
  {
    "name": "INFO.PERSPECTIVEMEASURES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-perspectivemeasures/"
  },
  {
    "name": "INFO.PERSPECTIVES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-perspectives/"
  },
  {
    "name": "INFO.PERSPECTIVETABLES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-perspectivetables/"
  },
  {
    "name": "INFO.PROPERTIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-properties/"
  },
  {
    "name": "INFO.QUERYGROUPS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-querygroups/"
  },
  {
    "name": "INFO.REFRESHPOLICIES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-refreshpolicies/"
  },
  {
    "name": "INFO.RELATEDCOLUMNDETAILS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-relatedcolumndetails/"
  },
  {
    "name": "INFO.RELATIONSHIPINDEXSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-relationshipindexstorages/"
  },
  {
    "name": "INFO.RELATIONSHIPS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-relationships/"
  },
  {
    "name": "INFO.RELATIONSHIPSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-relationshipstorages/"
  },
  {
    "name": "INFO.ROLEMEMBERSHIPS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-rolememberships/"
  },
  {
    "name": "INFO.ROLES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-roles/"
  },
  {
    "name": "INFO.SEGMENTMAPSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-segmentmapstorages/"
  },
  {
    "name": "INFO.SEGMENTSTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-segmentstorages/"
  },
  {
    "name": "INFO.STORAGEFILES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-storagefiles/"
  },
  {
    "name": "INFO.STORAGEFOLDERS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-storagefolders/"
  },
  {
    "name": "INFO.STORAGETABLECOLUMNS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-storagetablecolumns/"
  },
  {
    "name": "INFO.STORAGETABLECOLUMNSEGMENTS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-storagetablecolumnsegments/"
  },
  {
    "name": "INFO.TABLEPERMISSIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-tablepermissions/"
  },
  {
    "name": "INFO.TABLES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-tables/"
  },
  {
    "name": "INFO.TABLESTORAGES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-tablestorages/"
  },
  {
    "name": "INFO.USERDEFINEDFUNCTIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-userdefinedfunctions/"
  },
  {
    "name": "INFO.VARIATIONS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-variations/"
  },
  {
    "name": "INFO.VIEW.COLUMNS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-view-columns/"
  },
  {
    "name": "INFO.VIEW.MEASURES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-view-measures/"
  },
  {
    "name": "INFO.VIEW.RELATIONSHIPS",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-view-relationships/"
  },
  {
    "name": "INFO.VIEW.TABLES",
    "category": "Information",
    "guideUrl": "https://dax.guide/info-view-tables/"
  },
  {
    "name": "ISAFTER",
    "category": "Information",
    "guideUrl": "https://dax.guide/isafter/"
  },
  {
    "name": "ISBLANK",
    "category": "Information",
    "guideUrl": "https://dax.guide/isblank/"
  },
  {
    "name": "ISBOOLEAN",
    "category": "Information",
    "guideUrl": "https://dax.guide/isboolean/"
  },
  {
    "name": "ISCROSSFILTERED",
    "category": "Information",
    "guideUrl": "https://dax.guide/iscrossfiltered/"
  },
  {
    "name": "ISDATETIME",
    "category": "Information",
    "guideUrl": "https://dax.guide/isdatetime/"
  },
  {
    "name": "ISDECIMAL",
    "category": "Information",
    "guideUrl": "https://dax.guide/isdecimal/"
  },
  {
    "name": "ISDOUBLE",
    "category": "Information",
    "guideUrl": "https://dax.guide/isdouble/"
  },
  {
    "name": "ISEMPTY",
    "category": "Information",
    "guideUrl": "https://dax.guide/isempty/"
  },
  {
    "name": "ISERROR",
    "category": "Information",
    "guideUrl": "https://dax.guide/iserror/"
  },
  {
    "name": "ISEVEN",
    "category": "Information",
    "guideUrl": "https://dax.guide/iseven/"
  },
  {
    "name": "ISFILTERED",
    "category": "Information",
    "guideUrl": "https://dax.guide/isfiltered/"
  },
  {
    "name": "ISINSCOPE",
    "category": "Information",
    "guideUrl": "https://dax.guide/isinscope/"
  },
  {
    "name": "ISINT64",
    "category": "Information",
    "guideUrl": "https://dax.guide/isint64/"
  },
  {
    "name": "ISLOGICAL",
    "category": "Information",
    "guideUrl": "https://dax.guide/islogical/"
  },
  {
    "name": "ISNONTEXT",
    "category": "Information",
    "guideUrl": "https://dax.guide/isnontext/"
  },
  {
    "name": "ISNUMBER",
    "category": "Information",
    "guideUrl": "https://dax.guide/isnumber/"
  },
  {
    "name": "ISNUMERIC",
    "category": "Information",
    "guideUrl": "https://dax.guide/isnumeric/"
  },
  {
    "name": "ISODD",
    "category": "Information",
    "guideUrl": "https://dax.guide/isodd/"
  },
  {
    "name": "ISONORAFTER",
    "category": "Information",
    "guideUrl": "https://dax.guide/isonorafter/"
  },
  {
    "name": "ISSELECTEDMEASURE",
    "category": "Information",
    "guideUrl": "https://dax.guide/isselectedmeasure/"
  },
  {
    "name": "ISSTRING",
    "category": "Information",
    "guideUrl": "https://dax.guide/isstring/"
  },
  {
    "name": "ISSUBTOTAL",
    "category": "Information",
    "guideUrl": "https://dax.guide/issubtotal/"
  },
  {
    "name": "ISTEXT",
    "category": "Information",
    "guideUrl": "https://dax.guide/istext/"
  },
  {
    "name": "NAMEOF",
    "category": "Information",
    "guideUrl": "https://dax.guide/nameof/"
  },
  {
    "name": "SELECTEDMEASURE",
    "category": "Information",
    "guideUrl": "https://dax.guide/selectedmeasure/"
  },
  {
    "name": "SELECTEDMEASUREFORMATSTRING",
    "category": "Information",
    "guideUrl": "https://dax.guide/selectedmeasureformatstring/"
  },
  {
    "name": "SELECTEDMEASURENAME",
    "category": "Information",
    "guideUrl": "https://dax.guide/selectedmeasurename/"
  },
  {
    "name": "TABLEOF",
    "category": "Information",
    "guideUrl": "https://dax.guide/tableof/"
  },
  {
    "name": "TEXTCONTAINS",
    "category": "Information",
    "guideUrl": "https://dax.guide/textcontains/"
  },
  {
    "name": "TEXTSIMILARITY",
    "category": "Information",
    "guideUrl": "https://dax.guide/textsimilarity/"
  },
  {
    "name": "USERCULTURE",
    "category": "Information",
    "guideUrl": "https://dax.guide/userculture/"
  },
  {
    "name": "USERNAME",
    "category": "Information",
    "guideUrl": "https://dax.guide/username/"
  },
  {
    "name": "USEROBJECTID",
    "category": "Information",
    "guideUrl": "https://dax.guide/userobjectid/"
  },
  {
    "name": "USERPRINCIPALNAME",
    "category": "Information",
    "guideUrl": "https://dax.guide/userprincipalname/"
  },
  {
    "name": "AND",
    "category": "Logical",
    "guideUrl": "https://dax.guide/and/"
  },
  {
    "name": "BITAND",
    "category": "Logical",
    "guideUrl": "https://dax.guide/bitand/"
  },
  {
    "name": "BITOR",
    "category": "Logical",
    "guideUrl": "https://dax.guide/bitor/"
  },
  {
    "name": "BITXOR",
    "category": "Logical",
    "guideUrl": "https://dax.guide/bitxor/"
  },
  {
    "name": "COALESCE",
    "category": "Logical",
    "guideUrl": "https://dax.guide/coalesce/"
  },
  {
    "name": "FALSE",
    "category": "Logical",
    "guideUrl": "https://dax.guide/false/"
  },
  {
    "name": "IF",
    "category": "Logical",
    "guideUrl": "https://dax.guide/if/"
  },
  {
    "name": "IF.EAGER",
    "category": "Logical",
    "guideUrl": "https://dax.guide/if-eager/"
  },
  {
    "name": "IFERROR",
    "category": "Logical",
    "guideUrl": "https://dax.guide/iferror/"
  },
  {
    "name": "NOT",
    "category": "Logical",
    "guideUrl": "https://dax.guide/not/"
  },
  {
    "name": "OR",
    "category": "Logical",
    "guideUrl": "https://dax.guide/or/"
  },
  {
    "name": "SWITCH",
    "category": "Logical",
    "guideUrl": "https://dax.guide/switch/"
  },
  {
    "name": "TRUE",
    "category": "Logical",
    "guideUrl": "https://dax.guide/true/"
  },
  {
    "name": "ABS",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/abs/"
  },
  {
    "name": "ACOS",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/acos/"
  },
  {
    "name": "ACOSH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/acosh/"
  },
  {
    "name": "ACOT",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/acot/"
  },
  {
    "name": "ACOTH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/acoth/"
  },
  {
    "name": "ASIN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/asin/"
  },
  {
    "name": "ASINH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/asinh/"
  },
  {
    "name": "ATAN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/atan/"
  },
  {
    "name": "ATANH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/atanh/"
  },
  {
    "name": "CEILING",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/ceiling/"
  },
  {
    "name": "CONVERT",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/convert/"
  },
  {
    "name": "COS",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/cos/"
  },
  {
    "name": "COSH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/cosh/"
  },
  {
    "name": "COT",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/cot/"
  },
  {
    "name": "COTH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/coth/"
  },
  {
    "name": "CURRENCY",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/currency/"
  },
  {
    "name": "DEGREES",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/degrees/"
  },
  {
    "name": "DIVIDE",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/divide/"
  },
  {
    "name": "EVEN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/even/"
  },
  {
    "name": "EXP",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/exp/"
  },
  {
    "name": "FACT",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/fact/"
  },
  {
    "name": "FLOOR",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/floor/"
  },
  {
    "name": "GCD",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/gcd/"
  },
  {
    "name": "INT",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/int/"
  },
  {
    "name": "ISO.CEILING",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/iso-ceiling/"
  },
  {
    "name": "LCM",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/lcm/"
  },
  {
    "name": "LN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/ln/"
  },
  {
    "name": "LOG",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/log/"
  },
  {
    "name": "LOG10",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/log10/"
  },
  {
    "name": "MOD",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/mod/"
  },
  {
    "name": "MROUND",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/mround/"
  },
  {
    "name": "ODD",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/odd/"
  },
  {
    "name": "PI",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/pi/"
  },
  {
    "name": "POWER",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/power/"
  },
  {
    "name": "QUOTIENT",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/quotient/"
  },
  {
    "name": "RADIANS",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/radians/"
  },
  {
    "name": "RAND",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/rand/"
  },
  {
    "name": "RANDBETWEEN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/randbetween/"
  },
  {
    "name": "ROUND",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/round/"
  },
  {
    "name": "ROUNDDOWN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/rounddown/"
  },
  {
    "name": "ROUNDUP",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/roundup/"
  },
  {
    "name": "SIGN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/sign/"
  },
  {
    "name": "SIN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/sin/"
  },
  {
    "name": "SINH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/sinh/"
  },
  {
    "name": "SQRT",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/sqrt/"
  },
  {
    "name": "SQRTPI",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/sqrtpi/"
  },
  {
    "name": "TAN",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/tan/"
  },
  {
    "name": "TANH",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/tanh/"
  },
  {
    "name": "TRUNC",
    "category": "Math and Trig",
    "guideUrl": "https://dax.guide/trunc/"
  },
  {
    "name": "BITLSHIFT",
    "category": "Other",
    "guideUrl": "https://dax.guide/bitlshift/"
  },
  {
    "name": "BITRSHIFT",
    "category": "Other",
    "guideUrl": "https://dax.guide/bitrshift/"
  },
  {
    "name": "BLANK",
    "category": "Other",
    "guideUrl": "https://dax.guide/blank/"
  },
  {
    "name": "EARLIER",
    "category": "Other",
    "guideUrl": "https://dax.guide/earlier/"
  },
  {
    "name": "EARLIEST",
    "category": "Other",
    "guideUrl": "https://dax.guide/earliest/"
  },
  {
    "name": "ERROR",
    "category": "Other",
    "guideUrl": "https://dax.guide/error/"
  },
  {
    "name": "EXTERNALMEASURE",
    "category": "Other",
    "guideUrl": "https://dax.guide/externalmeasure/"
  },
  {
    "name": "HASH",
    "category": "Other",
    "guideUrl": "https://dax.guide/hash/"
  },
  {
    "name": "INFO.STORAGETABLES",
    "category": "Other",
    "guideUrl": "https://dax.guide/info-storagetables/"
  },
  {
    "name": "ISATLEVEL",
    "category": "Other",
    "guideUrl": "https://dax.guide/isatlevel/"
  },
  {
    "name": "ISCURRENCY",
    "category": "Other",
    "guideUrl": "https://dax.guide/iscurrency/"
  },
  {
    "name": "ISINTEGER",
    "category": "Other",
    "guideUrl": "https://dax.guide/isinteger/"
  },
  {
    "name": "KEYWORDMATCH",
    "category": "Other",
    "guideUrl": "https://dax.guide/keywordmatch/"
  },
  {
    "name": "RANK",
    "category": "Other",
    "guideUrl": "https://dax.guide/rank/"
  },
  {
    "name": "ROWNUMBER",
    "category": "Other",
    "guideUrl": "https://dax.guide/rownumber/"
  },
  {
    "name": "SAMPLECARTESIANPOINTSBYCOVER",
    "category": "Other",
    "guideUrl": "https://dax.guide/samplecartesianpointsbycover/"
  },
  {
    "name": "PATH",
    "category": "Parent-Child",
    "guideUrl": "https://dax.guide/path/"
  },
  {
    "name": "PATHCONTAINS",
    "category": "Parent-Child",
    "guideUrl": "https://dax.guide/pathcontains/"
  },
  {
    "name": "PATHITEM",
    "category": "Parent-Child",
    "guideUrl": "https://dax.guide/pathitem/"
  },
  {
    "name": "PATHITEMREVERSE",
    "category": "Parent-Child",
    "guideUrl": "https://dax.guide/pathitemreverse/"
  },
  {
    "name": "PATHLENGTH",
    "category": "Parent-Child",
    "guideUrl": "https://dax.guide/pathlength/"
  },
  {
    "name": "CROSSFILTER",
    "category": "Relationship",
    "guideUrl": "https://dax.guide/crossfilter/"
  },
  {
    "name": "RELATED",
    "category": "Relationship",
    "guideUrl": "https://dax.guide/related/"
  },
  {
    "name": "RELATEDTABLE",
    "category": "Relationship",
    "guideUrl": "https://dax.guide/relatedtable/"
  },
  {
    "name": "USERELATIONSHIP",
    "category": "Relationship",
    "guideUrl": "https://dax.guide/userelationship/"
  },
  {
    "name": "BETA.DIST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/beta-dist/"
  },
  {
    "name": "BETA.INV",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/beta-inv/"
  },
  {
    "name": "CHISQ.DIST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/chisq-dist/"
  },
  {
    "name": "CHISQ.DIST.RT",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/chisq-dist-rt/"
  },
  {
    "name": "CHISQ.INV",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/chisq-inv/"
  },
  {
    "name": "CHISQ.INV.RT",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/chisq-inv-rt/"
  },
  {
    "name": "COMBIN",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/combin/"
  },
  {
    "name": "COMBINA",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/combina/"
  },
  {
    "name": "CONFIDENCE.NORM",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/confidence-norm/"
  },
  {
    "name": "CONFIDENCE.T",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/confidence-t/"
  },
  {
    "name": "EXPON.DIST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/expon-dist/"
  },
  {
    "name": "GEOMEAN",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/geomean/"
  },
  {
    "name": "GEOMEANX",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/geomeanx/"
  },
  {
    "name": "LINEST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/linest/"
  },
  {
    "name": "LINESTX",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/linestx/"
  },
  {
    "name": "MEDIAN",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/median/"
  },
  {
    "name": "MEDIANX",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/medianx/"
  },
  {
    "name": "NORM.DIST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/norm-dist/"
  },
  {
    "name": "NORM.INV",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/norm-inv/"
  },
  {
    "name": "NORM.S.DIST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/norm-s-dist/"
  },
  {
    "name": "NORM.S.INV",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/norm-s-inv/"
  },
  {
    "name": "PERCENTILE.EXC",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/percentile-exc/"
  },
  {
    "name": "PERCENTILE.INC",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/percentile-inc/"
  },
  {
    "name": "PERCENTILEX.EXC",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/percentilex-exc/"
  },
  {
    "name": "PERCENTILEX.INC",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/percentilex-inc/"
  },
  {
    "name": "PERMUT",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/permut/"
  },
  {
    "name": "POISSON.DIST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/poisson-dist/"
  },
  {
    "name": "RANK.EQ",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/rank-eq/"
  },
  {
    "name": "RANKX",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/rankx/"
  },
  {
    "name": "SAMPLE",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/sample/"
  },
  {
    "name": "STDEV.P",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/stdev-p/"
  },
  {
    "name": "STDEV.S",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/stdev-s/"
  },
  {
    "name": "STDEVX.P",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/stdevx-p/"
  },
  {
    "name": "STDEVX.S",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/stdevx-s/"
  },
  {
    "name": "T.DIST",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/t-dist/"
  },
  {
    "name": "T.DIST.2T",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/t-dist-2t/"
  },
  {
    "name": "T.DIST.RT",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/t-dist-rt/"
  },
  {
    "name": "T.INV",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/t-inv/"
  },
  {
    "name": "T.INV.2T",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/t-inv-2t/"
  },
  {
    "name": "VAR.P",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/var-p/"
  },
  {
    "name": "VAR.S",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/var-s/"
  },
  {
    "name": "VARX.P",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/varx-p/"
  },
  {
    "name": "VARX.S",
    "category": "Statistical",
    "guideUrl": "https://dax.guide/varx-s/"
  },
  {
    "name": "ADDCOLUMNS",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/addcolumns/"
  },
  {
    "name": "ADDMISSINGITEMS",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/addmissingitems/"
  },
  {
    "name": "CROSSJOIN",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/crossjoin/"
  },
  {
    "name": "CURRENTGROUP",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/currentgroup/"
  },
  {
    "name": "DATATABLE",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/datatable/"
  },
  {
    "name": "DETAILROWS",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/detailrows/"
  },
  {
    "name": "DISTINCT",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/distinct/"
  },
  {
    "name": "EXCEPT",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/except/"
  },
  {
    "name": "FILTERS",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/filters/"
  },
  {
    "name": "GENERATE",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/generate/"
  },
  {
    "name": "GENERATEALL",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/generateall/"
  },
  {
    "name": "GENERATESERIES",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/generateseries/"
  },
  {
    "name": "GROUPBY",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/groupby/"
  },
  {
    "name": "IGNORE",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/ignore/"
  },
  {
    "name": "INTERSECT",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/intersect/"
  },
  {
    "name": "NATURALINNERJOIN",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/naturalinnerjoin/"
  },
  {
    "name": "NATURALJOINUSAGE",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/naturaljoinusage/"
  },
  {
    "name": "NATURALLEFTOUTERJOIN",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/naturalleftouterjoin/"
  },
  {
    "name": "NONVISUAL",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/nonvisual/"
  },
  {
    "name": "ROLLUP",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/rollup/"
  },
  {
    "name": "ROLLUPADDISSUBTOTAL",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/rollupaddissubtotal/"
  },
  {
    "name": "ROLLUPGROUP",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/rollupgroup/"
  },
  {
    "name": "ROLLUPISSUBTOTAL",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/rollupissubtotal/"
  },
  {
    "name": "ROW",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/row/"
  },
  {
    "name": "SAMPLEAXISWITHLOCALMINMAX",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/sampleaxiswithlocalminmax/"
  },
  {
    "name": "SELECTCOLUMNS",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/selectcolumns/"
  },
  {
    "name": "SUBSTITUTEWITHINDEX",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/substitutewithindex/"
  },
  {
    "name": "SUMMARIZE",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/summarize/"
  },
  {
    "name": "SUMMARIZECOLUMNS",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/summarizecolumns/"
  },
  {
    "name": "TOPN",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/topn/"
  },
  {
    "name": "TOPNPERLEVEL",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/topnperlevel/"
  },
  {
    "name": "TOPNSKIP",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/topnskip/"
  },
  {
    "name": "TREATAS",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/treatas/"
  },
  {
    "name": "UNION",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/union/"
  },
  {
    "name": "VALUES",
    "category": "Table manipulation",
    "guideUrl": "https://dax.guide/values/"
  },
  {
    "name": "COMBINEVALUES",
    "category": "Text",
    "guideUrl": "https://dax.guide/combinevalues/"
  },
  {
    "name": "CONCATENATE",
    "category": "Text",
    "guideUrl": "https://dax.guide/concatenate/"
  },
  {
    "name": "CONCATENATEX",
    "category": "Text",
    "guideUrl": "https://dax.guide/concatenatex/"
  },
  {
    "name": "EXACT",
    "category": "Text",
    "guideUrl": "https://dax.guide/exact/"
  },
  {
    "name": "FIND",
    "category": "Text",
    "guideUrl": "https://dax.guide/find/"
  },
  {
    "name": "FIXED",
    "category": "Text",
    "guideUrl": "https://dax.guide/fixed/"
  },
  {
    "name": "FORMAT",
    "category": "Text",
    "guideUrl": "https://dax.guide/format/"
  },
  {
    "name": "LEFT",
    "category": "Text",
    "guideUrl": "https://dax.guide/left/"
  },
  {
    "name": "LEN",
    "category": "Text",
    "guideUrl": "https://dax.guide/len/"
  },
  {
    "name": "LOWER",
    "category": "Text",
    "guideUrl": "https://dax.guide/lower/"
  },
  {
    "name": "MID",
    "category": "Text",
    "guideUrl": "https://dax.guide/mid/"
  },
  {
    "name": "REPLACE",
    "category": "Text",
    "guideUrl": "https://dax.guide/replace/"
  },
  {
    "name": "REPT",
    "category": "Text",
    "guideUrl": "https://dax.guide/rept/"
  },
  {
    "name": "RIGHT",
    "category": "Text",
    "guideUrl": "https://dax.guide/right/"
  },
  {
    "name": "SEARCH",
    "category": "Text",
    "guideUrl": "https://dax.guide/search/"
  },
  {
    "name": "SUBSTITUTE",
    "category": "Text",
    "guideUrl": "https://dax.guide/substitute/"
  },
  {
    "name": "TOCSV",
    "category": "Text",
    "guideUrl": "https://dax.guide/tocsv/"
  },
  {
    "name": "TOJSON",
    "category": "Text",
    "guideUrl": "https://dax.guide/tojson/"
  },
  {
    "name": "TRIM",
    "category": "Text",
    "guideUrl": "https://dax.guide/trim/"
  },
  {
    "name": "UNICHAR",
    "category": "Text",
    "guideUrl": "https://dax.guide/unichar/"
  },
  {
    "name": "UNICODE",
    "category": "Text",
    "guideUrl": "https://dax.guide/unicode/"
  },
  {
    "name": "UPPER",
    "category": "Text",
    "guideUrl": "https://dax.guide/upper/"
  },
  {
    "name": "VALUE",
    "category": "Text",
    "guideUrl": "https://dax.guide/value/"
  },
  {
    "name": "CLOSINGBALANCEMONTH",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/closingbalancemonth/"
  },
  {
    "name": "CLOSINGBALANCEQUARTER",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/closingbalancequarter/"
  },
  {
    "name": "CLOSINGBALANCEWEEK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/closingbalanceweek/"
  },
  {
    "name": "CLOSINGBALANCEYEAR",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/closingbalanceyear/"
  },
  {
    "name": "DATEADD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/dateadd/"
  },
  {
    "name": "DATESBETWEEN",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/datesbetween/"
  },
  {
    "name": "DATESINPERIOD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/datesinperiod/"
  },
  {
    "name": "DATESMTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/datesmtd/"
  },
  {
    "name": "DATESQTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/datesqtd/"
  },
  {
    "name": "DATESWTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/dateswtd/"
  },
  {
    "name": "DATESYTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/datesytd/"
  },
  {
    "name": "ENDOFMONTH",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/endofmonth/"
  },
  {
    "name": "ENDOFQUARTER",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/endofquarter/"
  },
  {
    "name": "ENDOFWEEK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/endofweek/"
  },
  {
    "name": "ENDOFYEAR",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/endofyear/"
  },
  {
    "name": "FIRSTDATE",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/firstdate/"
  },
  {
    "name": "FIRSTNONBLANK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/firstnonblank/"
  },
  {
    "name": "FIRSTNONBLANKVALUE",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/firstnonblankvalue/"
  },
  {
    "name": "LASTDATE",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/lastdate/"
  },
  {
    "name": "LASTNONBLANK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/lastnonblank/"
  },
  {
    "name": "LASTNONBLANKVALUE",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/lastnonblankvalue/"
  },
  {
    "name": "NEXTDAY",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/nextday/"
  },
  {
    "name": "NEXTMONTH",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/nextmonth/"
  },
  {
    "name": "NEXTQUARTER",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/nextquarter/"
  },
  {
    "name": "NEXTWEEK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/nextweek/"
  },
  {
    "name": "NEXTYEAR",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/nextyear/"
  },
  {
    "name": "OPENINGBALANCEMONTH",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/openingbalancemonth/"
  },
  {
    "name": "OPENINGBALANCEQUARTER",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/openingbalancequarter/"
  },
  {
    "name": "OPENINGBALANCEWEEK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/openingbalanceweek/"
  },
  {
    "name": "OPENINGBALANCEYEAR",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/openingbalanceyear/"
  },
  {
    "name": "PARALLELPERIOD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/parallelperiod/"
  },
  {
    "name": "PREVIOUSDAY",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/previousday/"
  },
  {
    "name": "PREVIOUSMONTH",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/previousmonth/"
  },
  {
    "name": "PREVIOUSQUARTER",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/previousquarter/"
  },
  {
    "name": "PREVIOUSWEEK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/previousweek/"
  },
  {
    "name": "PREVIOUSYEAR",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/previousyear/"
  },
  {
    "name": "SAMEPERIODLASTYEAR",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/sameperiodlastyear/"
  },
  {
    "name": "STARTOFMONTH",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/startofmonth/"
  },
  {
    "name": "STARTOFQUARTER",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/startofquarter/"
  },
  {
    "name": "STARTOFWEEK",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/startofweek/"
  },
  {
    "name": "STARTOFYEAR",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/startofyear/"
  },
  {
    "name": "TOTALMTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/totalmtd/"
  },
  {
    "name": "TOTALQTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/totalqtd/"
  },
  {
    "name": "TOTALWTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/totalwtd/"
  },
  {
    "name": "TOTALYTD",
    "category": "Time Intelligence",
    "guideUrl": "https://dax.guide/totalytd/"
  },
  {
    "name": "COLLAPSE",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/collapse/"
  },
  {
    "name": "COLLAPSEALL",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/collapseall/"
  },
  {
    "name": "EXPAND",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/expand/"
  },
  {
    "name": "EXPANDALL",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/expandall/"
  },
  {
    "name": "FIRST",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/first/"
  },
  {
    "name": "LAST",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/last/"
  },
  {
    "name": "MOVINGAVERAGE",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/movingaverage/"
  },
  {
    "name": "NEXT",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/next/"
  },
  {
    "name": "PREVIOUS",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/previous/"
  },
  {
    "name": "RANGE",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/range/"
  },
  {
    "name": "RUNNINGSUM",
    "category": "Visual Calculations",
    "guideUrl": "https://dax.guide/runningsum/"
  }
];

export const TOTAL_DAX_GUIDE_FUNCTIONS = DAX_GUIDE_INDEX.length;
