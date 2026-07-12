/*
=========================================
GENERIC REFERENCE NUMBER GENERATOR
=========================================
*/

export const generateReferenceNumber = (prefix = "REF") => {

    const timestamp = Date.now().toString().slice(-8);

    const random = Math.floor(100 + Math.random() * 900);

    return `${prefix}-${timestamp}${random}`;

};

export default generateReferenceNumber;