import fs from 'fs';
import pdf from 'html-pdf';
import hummus from 'hummus';
import memoryStreams from 'memory-streams';
import { Service } from "typedi";
import { logger } from "../../logger";
import BaseService from "../../services/BaseService";
import { isNotNullAndUndefined, uuidv4 } from "../../utils/Utils";
import { Invoice } from "./Invoice";
import getTeamRegistrationInvoiceTemplate from "./TeamRegistrationInvoiceTemplate";

@Service()
export default class InvoiceService extends BaseService<Invoice> {

    modelName(): string {
        return Invoice.name;
    }

    public async findByRegistrationId(registrationId: number): Promise<Invoice> {
        return await this.entityManager.createQueryBuilder().select().from(Invoice, 'inv')
            .andWhere("inv.registrationId = :registrationId", { registrationId })
            .andWhere("inv.isDeleted = 0").execute();
    }

    public async deleteByRegistrationId(registrationId: number){
        try{
            let result = await this.entityManager.query(
                ` update wsa_registrations.invoice set isDeleted = 1 where registrationId = ? and isDeleted = 0 `,[registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async getPaymentStatusTeamIndividual(registrationId: number, userRegistrationId: number): Promise<Invoice> {
        return await this.entityManager.createQueryBuilder().select().from(Invoice, 'inv')
            .andWhere("inv.registrationId = :registrationId", { registrationId })
            .andWhere("inv.userRegistrationId = :userRegistrationId", {userRegistrationId})
            .andWhere("inv.isDeleted = 0").execute();
    }

    public async getPaymentStatusByInvoiceId(invoiceId: number): Promise<Invoice> {
        return await this.entityManager.createQueryBuilder().select().from(Invoice, 'inv')
            .andWhere("inv.id = :invoiceId", { invoiceId })
            .andWhere("inv.isDeleted = 0").execute();
    }

    public async getPaymentStatusByteamMemberRegId(teamMemberRegId): Promise<Invoice> {
        return await this.entityManager.createQueryBuilder().select().from(Invoice, 'inv')
            .andWhere("inv.teamMemberRegId = :teamMemberRegId", { teamMemberRegId })
            .andWhere("inv.isDeleted = 0").execute();
    }

    public async getPaymentStatusByCartId(cartId: number): Promise<Invoice> {
        return await this.entityManager.createQueryBuilder().select().from(Invoice, 'inv')
            .andWhere("inv.cartId = :cartId", { cartId })
            .andWhere("inv.isDeleted = 0").execute();
    }

    public async updatePaymentStatusByRegistrationID(registrationId: number): Promise<any> {
        return await this.entityManager.query(`update wsa_registrations.invoice 
        set paymentStatus = 'success' where registrationId = ? and isDeleted = 0`,
            [registrationId]);
    }

    public async updatePaymentStatusByTeamMemberRegId(teamMemberRegId): Promise<any> {
        return await this.entityManager.query(`update wsa_registrations.invoice 
        set paymentStatus = 'success' where teamMemberRegId = ? and isDeleted = 0`,
            [teamMemberRegId]);
    }

    public async updateTeamPaymentStatusByRegistrationID(registrationId: number, userRegId: number): Promise<any> {
        return await this.entityManager.query(`update wsa_registrations.invoice 
        set paymentStatus = 'success' where registrationId = ? and userRegistrationId = ? and isDeleted = 0`,
            [registrationId, userRegId]);
    }

    public async updatePaymentStatusByInvoiceId(invoiceId: number, status: string, userId: number = null): Promise<any> {
        return await this.entityManager.query(`update wsa_registrations.invoice 
        set paymentStatus = ?, updatedOn = ?, updatedBy = ? where id = ? and isDeleted = 0`,
            [status, new Date(), userId, invoiceId]);
    }

    public async getInvoiceReciptId(): Promise<any> {
        let query =  await this.entityManager.query(`select IFNULL(receiptId, 100000) as receiptId from wsa_registrations.invoice order by id desc LIMIT 1`);
        let result = query.find(x=>x); 
        return result ? result : {receiptId: 100000};
    }

    //Generate PDF

    public  async printTeamRegistrationInvoiceTemplate(invoiceData: any): Promise<any>{
        try {
            let pdfBuf: Buffer;
            const createPDF = (html, options): Promise<Buffer> => new Promise(((resolve, reject) => {
                pdf.create(html, options).toBuffer((err, buffer) => {
                    if (err !== null) {
                        reject(err);
                    } else {
                        resolve(buffer);
                    }
                });
            }));
            let htmlTmpl = '';
            let fileName = null;
            if(isNotNullAndUndefined(invoiceData)){
                htmlTmpl = getTeamRegistrationInvoiceTemplate(invoiceData);
                console.log("htmlTmpl::");

                const options = {format: 'A4'};

                await createPDF(htmlTmpl, options).then((newBuffer) => {
                    if (pdfBuf) {
                        pdfBuf = this.combinePDFBuffers(pdfBuf, newBuffer);
                    } else {
                        pdfBuf = newBuffer;
                    }
                });
                fileName = uuidv4()+ '.pdf';
                fs.writeFileSync("output/"+fileName,pdfBuf);
            }


            return fileName;

        } catch (error) {
            logger.error(` ERROR occurred in invoice service `+error)
            throw error;
        }
    }

     /**
     * Concatenate two PDFs in Buffers
     * @param {Buffer} firstBuffer
     * @param {Buffer} secondBuffer
     * @returns {Buffer} - a Buffer containing the concactenated PDFs
     */
    private combinePDFBuffers = (firstBuffer: Buffer, secondBuffer: Buffer): Buffer => {
        const outStream = new memoryStreams.WritableStream();

        try {
            const firstPDFStream = new hummus.PDFRStreamForBuffer(firstBuffer);
            const secondPDFStream = new hummus.PDFRStreamForBuffer(secondBuffer);

            const pdfWriter = hummus.createWriterToModify(firstPDFStream, new hummus.PDFStreamForResponse(outStream));
            pdfWriter.appendPDFPagesFromPDF(secondPDFStream);
            pdfWriter.end();
            const newBuffer = outStream.toBuffer();
            outStream.end();

            return newBuffer;
        }
        catch(e){
            outStream.end();
        }
    };
}
