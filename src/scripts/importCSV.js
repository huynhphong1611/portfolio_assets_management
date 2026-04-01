/**
 * CSV Import Script
 * 
 * Parse CSV file and import to Firebase Firestore.
 * Run this once from the browser UI to import the 58 transactions.
 */

import { batchImportTransactions } from '../services/firestoreService';

/**
 * Parse the raw CSV text and return an array of transaction objects
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  // Skip header (first 4 lines are header with multi-line note)
  // Find where actual data starts (lines with dates)
  const transactions = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if line starts with a date pattern (dd/mm/yyyy)
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}),/);
    if (!dateMatch) continue;
    
    // Parse the CSV line (handle quoted fields with commas)
    const fields = parseCSVLine(line);
    
    if (fields.length < 10) continue;
    
    const date = fields[0]?.trim();
    const transactionType = fields[1]?.trim();
    const assetClass = fields[2]?.trim();
    const ticker = fields[3]?.trim();
    const quantity = parseVNNumber(fields[4]);
    const unitPrice = parseVNNumber(fields[5]);
    const currency = fields[6]?.trim() || 'VNĐ';
    const exchangeRate = parseVNNumber(fields[7]) || 1;
    const costBasisValue = parseVNNumber(fields[8]) || 0;
    const totalVND = parseVNNumber(fields[9]) || 0;
    const pnlVND = parseVNNumber(fields[10]) || 0;
    const pnlPercent = parseVNPercent(fields[11]) || 0;
    const storage = fields[12]?.trim() || '';
    const notes = fields[13]?.trim()?.replace(/^"|"$/g, '') || '';
    
    if (!date || !transactionType) continue;
    if (totalVND === 0 && quantity === 0) continue; // skip empty rows
    
    transactions.push({
      date,
      transactionType,
      assetClass,
      ticker,
      quantity: transactionType === 'Bán' ? -Math.abs(quantity) : Math.abs(quantity),
      unitPrice,
      currency,
      exchangeRate,
      costBasisValue,
      totalVND: Math.abs(totalVND),
      pnlVND,
      pnlPercent,
      storage,
      notes
    });
  }
  
  return transactions;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else if (char === '\r') {
      // skip carriage return
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

/**
 * Parse Vietnamese number format
 * "25.794.645,76000" → 25794645.76
 * "22044,61" → 22044.61
 * "-45,02000" → -45.02
 */
function parseVNNumber(str) {
  if (!str) return 0;
  str = str.trim().replace(/^"|"$/g, '');
  if (!str) return 0;
  
  // Check if it uses Vietnamese format (dots for thousands, comma for decimal)
  const cleaned = str
    .replace(/\./g, '')    // remove dots (thousand separators)  
    .replace(',', '.');    // replace comma with dot (decimal)
  
  return parseFloat(cleaned) || 0;
}

/**
 * Parse Vietnamese percent string
 * "6,720218748%" → 6.720218748
 */
function parseVNPercent(str) {
  if (!str) return 0;
  str = str.trim().replace(/^"|"$/g, '').replace('%', '');
  return parseVNNumber(str);
}

/**
 * Import CSV data into Firebase Firestore
 */
export async function importCSVToFirestore(csvText) {
  const transactions = parseCSV(csvText);
  
  if (transactions.length === 0) {
    throw new Error('No valid transactions found in CSV');
  }
  
  console.log(`Parsed ${transactions.length} transactions. Importing to Firestore...`);
  
  await batchImportTransactions(transactions);
  
  console.log(`✅ Successfully imported ${transactions.length} transactions!`);
  return transactions.length;
}

/**
 * The actual CSV data embedded for direct import
 */
export const CSV_RAW_DATA = `Dấu thời gian,Loại giao dịch,Tài sản,Mã,Số lượng,Đơn giá nguyên tệ theo loại tài sản,Loại tiền (VNĐ | USDT),Tỷ giá lúc mua/bán(loại tiền / VNĐ),Giá trị bán theo giá vốn,Thành tiền (VNĐ),Lãi/Lỗ VNĐ,Lãi/Lỗ %,Nơi lưu trữ,Ghi chú
30/11/2025 23:06:30,Nạp tiền,Tiền mặt VNĐ,VNĐ,"25.794.645,76000",1,VNĐ,1,,"25794645,76",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:09:13,Mua,Trái phiếu,VFF,"22,68000","22044,61",VNĐ,1,,"499971,7548",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:10:53,Mua,Trái phiếu,VFF,"13,54000","22149,83",VNĐ,1,,"299908,6982",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:12:06,Mua,Trái phiếu,VFF,"8,80000","22710,54",VNĐ,1,,"199852,752",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:16:12,Bán,Trái phiếu,VFF,"-45,02000","23698,74",VNĐ,1,"999733,0284","-1066917,275","67184,2464","6,720218748%",,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:21:12,Mua,Trái phiếu,VFF,"176,32000","24838,54",VNĐ,1,,"4379531,373",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:30:10,Mua,Trái phiếu,DCBF,"10,25000","23256,88",VNĐ,1,,"238383,02",0,0%,Fmarket,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:30:49,Mua,Trái phiếu,DCBF,"7,96000","25118,29",VNĐ,1,,"199941,5884",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:31:17,Mua,Trái phiếu,DCBF,"23,24000",25807,VNĐ,1,,"599754,68",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:33:19,Bán,Trái phiếu,DCBF,"-41,45000","26918,08",VNĐ,1,"1038079,189","-1115754,416","77675,2275","7,482591729%",,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:34:14,Mua,Trái phiếu,DCBF,"36,31000","27535,38",VNĐ,1,,"999809,6478",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
30/11/2025 23:34:41,Mua,Trái phiếu,DCBF,"45,91000","28310,11",VNĐ,1,,"1299717,15",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:29:04,Mua,Cổ phiếu,VESAF,"32,47000","30788,61",VNĐ,1,,"999706,1667",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:29:48,Mua,Cổ phiếu,VESAF,"18,19000","27486,48",VNĐ,1,,"499979,0712",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:30:26,Mua,Cổ phiếu,VESAF,"71,87000","27827,72",VNĐ,1,,"1999978,236",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:30:48,Mua,Cổ phiếu,VESAF,"67,49000","29629,73",VNĐ,1,,"1999710,478",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:31:14,Mua,Cổ phiếu,VESAF,"29,67000","33698,64",VNĐ,1,,"999838,6488",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:33:30,Bán,Cổ phiếu,VESAF,"-119,00000","36841,71",VNĐ,1,"3401448,4","-4384163,49","982715,09","28,8910774%",,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:33:53,Mua,Cổ phiếu,VESAF,"28,08000","35607,27",VNĐ,1,,"999852,1416",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:34:14,Mua,Cổ phiếu,VESAF,"8,79000","34092,34",VNĐ,1,,"299671,6686",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:44:52,Mua,Cổ phiếu,DCDS,"22,67000","88192,47",VNĐ,1,,"1999323,295",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:45:46,Bán,Cổ phiếu,DCDS,"-12,00000","108432,16",VNĐ,1,"1.058.309,64","-1301185,92","242876,28","22,94945362%",,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 19:46:09,Mua,Cổ phiếu,DCDS,"9,33000","107088,7",VNĐ,1,,"999137,571",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:31:41,Mua,Tiền mặt USD,USDT,"193,20000",1,USDT,"25828,55",,"4990075,86",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:32:37,Bán,Tiền mặt USD,USDT,"-81,92000",1,USDT,25856,"2115874,82","-2118123,52","2248,7","0,1062775538%",,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:33:34,Bán,Tiền mặt USD,USDT,"-116,48000",1,USDT,25765,"3008509,5","-3001107,2","-7402,3","-0,2460454255%",,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:34:04,Mua,Tiền mặt USD,USDT,"50,00000",1,USDT,25918,,1295900,0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:34:33,Mua,Tiền mặt USD,USDT,"100,00000",1,USDT,25761,,2576100,0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:35:06,Mua,Tiền mặt USD,USDT,"53,36000",1,USDT,25815,,"1377488,4",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:35:29,Mua,Tiền mặt USD,USDT,"100,00000",1,USDT,25989,,2598900,0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:35:52,Mua,Tiền mặt USD,USDT,"115,67000",1,USDT,25935,,"2999901,45",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:36:17,Mua,Tiền mặt USD,USDT,"100,00000",1,USDT,25899,,2589900,0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:36:45,Mua,Tiền mặt USD,USDT,"95,63887",1,USDT,26140,,2500000,0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:37:14,Mua,Tiền mặt USD,USDT,"37,83883",1,USDT,26393,,"998680,35",0,0%,,Chuyển từ file ghi chép danh mục V3.1 sang
02/12/2025 22:40:00,Bán,Tiền mặt USD,USDT,"-100,09200",1,USDT,26566,"2598315,25","-2659044,072","60728,822","2,337238409%",,Chuyển từ file ghi chép danh mục V3.1 sang
03/12/2025 21:48:50,Bán,Tiền mặt USD,USDT,"-532,00000",1,USDT,"25957,31","13809288,92","-13809288,92",0,0,,Chuyển từ file ghi chép danh mục V3.1 sang
03/12/2025 21:49:17,Mua,Tài sản mã hóa,CMCP,"532,00000",1,USDT,"25957,31",,"13809288,92",0,0,,Chuyển từ file ghi chép danh mục V3.1 sang
25/12/2025 23:07:21,Nạp tiền,Tiền mặt VNĐ,VNĐ,"2.700.000,00000",1,VNĐ,1,,2700000,0,0,,
25/12/2025 23:10:26,Mua,Tiền mặt USD,USDT,"100,41000",1,USDT,26888,,"2699824,08",0,0,Binance,Mua USDT để thực hiện kế hoạch DCA năm 2026
26/12/2025 22:45:33,Nạp tiền,Tiền mặt VNĐ,VNĐ,"2.000.000,00000",1,VNĐ,1,,2000000,0,0,SSI PRO,Tiền để DCA VN diamond và Vn 100 cho hưu trí
26/12/2025 22:57:07,Bán,Tiền mặt VNĐ,USDT,"-55,00000",1,USDT,26847,1476585,-1476585,0,0,,bán ra để mua coin
26/12/2025 23:04:43,Mua,Tài sản mã hóa,CMCP,"93,22000","0,59",USDT,26847,,"1476579,631",0,0,Binance,DCA
04/01/2026 20:12:40,Mua,Cổ phiếu,FUEVFVND,"30,00000",37960,VNĐ,1,,1138800,0,0,SSI PRO,kì vọng vào năm 2026 chứng khoán tiếp tục tăng khi nhà nước nới lỏng
04/01/2026 20:13:37,Mua,Cổ phiếu,FUEVN100,"30,00000",25500,VNĐ,1,,765000,0,0,SSI PRO,DCA cho kế hoạch về hưu
30/01/2026 21:42:03,Nạp tiền,Tiền mặt VNĐ,VNĐ,"2.000.000,00000",1,VNĐ,1,,2000000,0,0,SSI,
03/02/2026 21:40:13,Mua,Tiền mặt USD,USDT,"350,00000",1,USDT,26690,,9341500,0,0,Binance,
03/02/2026 21:41:49,Nạp tiền,Tiền mặt VNĐ,VNĐ,"13.345.000,00000",1,VNĐ,1,,13345000,0,0,Binance,
03/02/2026 21:47:13,Mua,Tài sản mã hóa,CMCP,"188,60000","0,53",USDT,26690,,"2667879,02",0,0,Binance,
03/02/2026 21:48:11,Mua,Vàng,PAXG,"0,01028",4860,USDT,26690,,"1333453,752",0,0,Binance,
06/02/2026 16:14:23,Mua,Tài sản mã hóa,CMCP,"88,00000","0,57",USDT,27000,,1354320,0,0,Binance,Mua thêm BTC khi giá về 64k
06/02/2026 16:16:50,Bán,Tiền mặt USD,USDT,"-50,00000",1,USDT,27000,1334500,-1350000,15500,"0,01161483702",,
06/02/2026 16:21:43,Nạp tiền,Tiền mặt VNĐ,VNĐ,"50.000.000,00000",1,VNĐ,1,,50000000,0,0,Fmarket,
06/02/2026 16:23:45,Mua,Trái phiếu,DCIP,"4.186,47000","11943,21",VNĐ,1,,"49999890,37",0,0,Fmarket,
18/03/2026 22:30:29,Bán,Tài sản mã hóa,USDT,"-280,00000",1,USDT,26690,7473200,-7473200,0,0,Binance,ban usdt de mua dca btc eth
18/03/2026 22:34:59,Mua,Tài sản mã hóa,CMCP,"549,00000","0,51",USDT,26690,,"7472933,1",0,0,binance,
18/03/2026 22:57:58,Mua,Cổ phiếu,FUEVN100,"30,00000",27000,VNĐ,1,,810000,0,0,SSI,
18/03/2026 22:58:32,Mua,Cổ phiếu,FUEVFVND,"29,00000",40450,VNĐ,1,,1173050,0,0,SSI,
18/03/2026 22:58:53,Mua,Cổ phiếu,FUEVFVND,"1,00000",39730,VNĐ,1,,39730,0,0,SSI,`;

export { parseCSV };
