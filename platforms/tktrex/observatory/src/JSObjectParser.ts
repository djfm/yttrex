type JSRecord = string | number | boolean | JSRecord[] | JSRecordMap;
type JSRecordMap = { [key: string]: JSRecord };

export const JSObjectParser = (str: string): JSRecordMap => {

};

export default JSObjectParser;
