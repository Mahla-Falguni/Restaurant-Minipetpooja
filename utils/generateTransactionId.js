const generateTransactionId = () => {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, "0");

    const day = String(now.getDate()).padStart(2, "0");

    const random = Math.floor(100000 + Math.random() * 900000);

    return `TXN-${year}${month}${day}-${random}`;

};

export default generateTransactionId;