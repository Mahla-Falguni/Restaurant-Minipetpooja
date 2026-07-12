import QRCode from "qrcode";

const generateTableQR = async (tableCode) => {

  const menuURL = `${process.env.FRONTEND_URL}/menu/${tableCode}`;

  const qrData = await QRCode.toDataURL(menuURL);

  return qrData;
};

export default generateTableQR;