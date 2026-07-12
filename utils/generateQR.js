import QRCode from "qrcode";

const generateQR = async (tableId) => {

  try {

    const menuURL = `${process.env.FRONTEND_URL}/menu/${tableId}`;

    const qr = await QRCode.toDataURL(menuURL);

    return qr;

  } catch (error) {

    throw new Error("QR Generation Failed");
  }
};

export default generateQR;