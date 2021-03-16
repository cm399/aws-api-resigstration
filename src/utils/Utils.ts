import crypto from "crypto";
import * as jsonwebtoken from 'jsonwebtoken';
import * as jwt from "jwt-simple";
import * as path from 'path';

let moment = require('moment');

const privateKey = require("fs").readFileSync(path.join(__dirname, '../../private.key'));

export function md5(password: string): string {
    return crypto.createHash('md5').update(password).digest("hex");
}

export function authToken(email: string, password: string): string {
    const data = `${email.toLowerCase()}:${password}`;
    return jwt.encode({ data }, process.env.SECRET);
}

export function isNullOrEmpty(value: string): boolean {
    return (!value || 0 === value.length);
}

export function contain(arr, value): boolean {
    return arr.indexOf(value) > -1
}

export function chunk(array, size) {
    const chunked_arr = [];
    let copied = [...array];
    const numOfChild = Math.ceil(copied.length / size);
    for (let i = 0; i < numOfChild; i++) {
        chunked_arr.push(copied.splice(0, size));
    }
    return chunked_arr;
}

export function timestamp(): number {
    return new Date().getTime();
}

export function isPhoto(mimetype: string): boolean {
    return mimetype && mimetype == 'image/jpeg' || mimetype == 'image/jpg' || mimetype == 'image/png' || mimetype == 'image/gif' || mimetype == 'image/webp';
}

export function fileExt(fileName: string): string {
    return fileName.split('.').pop();
}

export function isVideo(mimetype: string): boolean {
    if (!mimetype) return false;
    switch (mimetype) {
        case 'video/mp4':
        case 'video/quicktime':
        case 'video/mpeg':
        case 'video/mp2t':
        case 'video/webm':
        case 'video/ogg':
        case 'video/x-ms-wmv':
        case 'video/x-msvideo':
        case 'video/3gpp':
        case 'video/3gpp2':
            return true;
        default:
            return false;
    }
}

export function isArrayPopulated(checkArray: any): boolean {
    if (checkArray !== 'undefined'
        && checkArray !== null
        && Array.isArray(checkArray)
        && checkArray.length > 0) {
        return true;
    }
    return false;
}

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function isStringNullOrEmpty(checkString: string): boolean {
    return typeof checkString === 'string' && checkString !== null && checkString.length > 0 ? true : false;
}

export function isPropertyNullOrZero(object: string | number): string | number {
    return object === null ? object = 0 : object;
}

export function stringTONumber(checkString: string | number): number {
    return typeof checkString === 'string' ? parseInt(checkString) : checkString;
}

export function booleanTONumber(value: boolean | number): number | null {
    return typeof value === 'boolean' ? (value ? 1 : 0) : (value === 1 || value === 0) ? value : null;
}

export function isNotNullAndUndefined(value: any): boolean {
    return value !== undefined && value !== null;
}

export function paginationData(totalCount: number, LIMIT: number, OFFSET: number) {
    let totalPages = Math.ceil(totalCount / LIMIT);
    let currentPage = Math.floor(OFFSET / LIMIT);
    let prevPage = (currentPage - 1) > 0 ? (currentPage - 1) * LIMIT : 0;
    let nextPage = (currentPage + 1) <= totalPages ? (currentPage + 1) * LIMIT : 0;

    return {
        page: {
            nextPage,
            prevPage,
            totalCount,
            currentPage: currentPage + 1
        }
    }
}

export interface Paging {
    limit: number,
    offset: number
}

export interface PagingData {
    paging: Paging;
}

export const lenientStrCompare = (a: string | null | undefined, b: string) => {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

export const lenientObjectCompare = (a, b, fields) => {
    return fields.every((field) => lenientStrCompare(a[field], b[field]))
}

export function isNullOrUndefined(e) {
    return (e === null || e === undefined) ? false : e;
}

export function isNullOrZero(e) {
    return (e === null || e === 0);
}

export interface AffiliatesPagingData {
    affiliatedToOrgId: number,
    organisationTypeRefId: number,
    stateRefId: number,
    paging: Paging
}

export async function generateJwtToken(uid) {
    const service_account_email = 'firebase-adminsdk-br5di@world-sport-action.iam.gserviceaccount.com'
    const payload = {
        "iss": service_account_email,
        "sub": service_account_email,
        "aud": "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
        "iat": Date.now(),
        "exp": Date.now() + (60 * 60),  // Maximum expiration time is one hour
        "uid": uid,
        "claims": {
            "premium_account": true,
            "team": 'competition',
            'logged': true
        }
    }
    return await jsonwebtoken.sign(payload, privateKey, { algorithm: 'RS256' });
}

export async function verifyJwtCustomToken(token) {
    return jsonwebtoken.decode(token, privateKey, { algorithm: 'RS256' })
}

export function decrypt(data) {
    var decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPT_TOKEN)
    var dec = decipher.update(data, 'hex', 'utf8')
    dec += decipher.final('utf8');
    return dec;
}

export function isNullOrUndefinedValue(e) {
    return (e === null || e === undefined) ? null : e;
}

export function stringTOFloatNumber(checkString: string | number): number {
    return typeof checkString === 'string' ? parseFloat(checkString) : checkString;
}

export function stringTOFloatNumberReg(checkString: string | number): number {
    return typeof checkString === 'string' ? Number(Number(checkString).toFixed(2)) : Number(Number(checkString).toFixed(2));
}

export function ArrayIsEmpty(checkArray: any): boolean {
    return (checkArray !== 'undefined' && checkArray !== null && Array.isArray(checkArray));
}

export function isNullOrNumber(e) {
    return (e === null) ? null : stringTOFloatNumber(e);
}

// export function feeIsNull(fee: string | number): number {
//     return ((fee === null||fee===undefined) ? 0 : (stringTOFloatNumber(fee)));
// }

export function feeIsNull(fee: string | number): number {
    return ((fee === null || fee === undefined) ? 0 : (stringTOFloatNumberReg(fee)));
}

export function calculateTotalAmount(casualFee: number, seasonalFee: number, casualGst: number, seasonalGst: number): number {
    return feeIsNull(casualFee) + feeIsNull(casualGst) + feeIsNull(seasonalFee) + feeIsNull(seasonalGst);
}

export function calculateFeeGstAmount(casualFeeGst: number, seasonalFeeGst: number): number {
    return feeIsNull(casualFeeGst) + feeIsNull(seasonalFeeGst);
}

export function formatPersonName(firstName: string, middleName: string, lastName: string): string {
    const firstName_ = firstName !== null ? firstName.trim() : '';
    const middleName_ = middleName !== null ? middleName.trim() : '';
    const lastName_ = lastName !== null ? lastName.trim() : '';

    return (middleName_ === null || middleName_ === undefined || middleName_ === '')
        ? `${firstName_} ${lastName_}`
        : `${firstName_} ${middleName_} ${lastName_}`;
}

export function formatFeeForStripe(totalFee: number): number {
    return stringTOFloatNumber((totalFee * 100).toFixed(2));
}

export function formatFeeForStripe1(totalFee: number): number {
    return Math.round(stringTOFloatNumber(totalFee * 100));
}

// export function formatValue(val: number): string {
//     return  val === null ? "0.00" : stringTOFloatNumber(val).toFixed(2)
// }

export function formatValue(val: number): string {
    return val === null ? "0.00" : stringTOFloatNumberReg(val).toFixed(2)
}

export function findHighest(numbers: any[]): number {
    return Math.max(...numbers)
}

export function calculateTotalFeeGst(competitionFee: number, membershipFee: number, affiliateFee: number, competitionGst: number, membershipGst: number, affiliateGst: number): number {
    return (feeIsNull(competitionFee) + feeIsNull(membershipFee) + feeIsNull(affiliateFee) + feeIsNull(competitionGst) + feeIsNull(membershipGst) + feeIsNull(affiliateGst));
}

export function objectIsNotEmpty(obj) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) return true;
    }
    return false;
}

export const fileUploadOptions = {
    limits: {
        fileSize: process.env.FILE_UPLOAD_SIZE
    }
};

export function getAge(date) {
    return (Math.floor((Date.now() - new Date(date).getTime()) / 3.15576e+10))
}

export const formatDate = date => moment(new Date(date * 1000)).format("DD/MM/YYYY");
export const formatDateAEST = date => moment(new Date(date * 1000)).tz("Australia/Sydney").format("DD/MM/YYYY");

export function convertUTCDateToLocalDate(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
}

export function isNegativeNumber(val) {
    return val < 0;
}

export function currencyFormat(data) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data);
}

export function getParentEmail(email: string): string {
    let parentEmail = email.split(".");
    let parentEmailString = parentEmail[0];
    for (let n = 1; n < parentEmail.length - 1; n++) {
        parentEmailString = parentEmailString + "." + parentEmail[n];
    }
    return parentEmailString;
}

export function getRegistrationField(value: any, field: string, checkField: string, statusField: string, approveField: string) {
    let result = '';
    if (value[statusField] == 3) {
        return 'Declined';
    }
    if (value[checkField] != '-1' && value[field] !== null && value[field] !== undefined) {
        result += value[field];
    }
    if (value[field] && value[statusField] == 0) {
        result += ' (' + value[approveField] + ')';
    }
    return result;
}

export function getApproveValue(value, approvedStatus) {
    if (approvedStatus == 3) return 'Declined';
    return value !== 'N/A' && value !== 'P' ? currencyFormat(value) : value;
}
