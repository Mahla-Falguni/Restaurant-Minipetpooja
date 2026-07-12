/*
=========================================
CSV EXPORTER UTILITY
Converts an array of flat objects into a CSV string.
No external dependency — works with plain arrays/objects.
=========================================
*/

export const convertToCSV = (rows) => {

    if (!rows || rows.length === 0) {
        return "";
    }

    const headers = Object.keys(rows[0]);

    const escapeValue = (value) => {

        if (value === null || value === undefined) {
            return "";
        }

        const stringValue = String(value);

        // Wrap in quotes if it contains comma, quote, or newline

        if (/[",\n]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;

    };

    const headerRow = headers.join(",");

    const dataRows = rows.map((row) =>
        headers.map((header) => escapeValue(row[header])).join(",")
    );

    return [headerRow, ...dataRows].join("\n");

};

export const sendCSVResponse = (res, filename, rows) => {

    const csv = convertToCSV(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(csv);

};