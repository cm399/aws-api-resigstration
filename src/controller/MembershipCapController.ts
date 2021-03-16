import { Response } from 'express';
import { Authorized, Body, Get, HeaderParam, JsonController, Post, QueryParam, Res } from 'routing-controllers';
import { MembershipCap } from '../models/registrations/MembershipCap';
import { MembershipCapProduct } from '../models/registrations/MembershipCapProduct';
import { MembershipFeeCap } from '../models/registrations/MembershipFeeCap';
import { User } from '../models/security/User';
import { isArrayPopulated, isNullOrZero } from "../utils/Utils";
import { BaseController } from './BaseController';

@JsonController('/api')
export class MembershipCapController extends BaseController {

    @Authorized()
    @Post('/membershipcap')
    async createMembershipCap(
    @Body() membershipCapBody: any,
    @HeaderParam("authorization") currentUser: User,
    @QueryParam("organisationUniqueKey") organisationUniqueKey: string,
    @QueryParam("yearRefId") yearRefId: number,
    @Res() response: Response): Promise<any> {
        try {
            let userId = currentUser.id;
            let memCapMap = new Map();
            let memCapProdMap = new Map();
            let memFeeCapMap = new Map();
            const ORGANISATION_ID = await this.organisationService.findByUniquekey(organisationUniqueKey);
            let mcExistRecord = await this.membershipCapService.getMembershipCapData(ORGANISATION_ID, yearRefId);

            if(isArrayPopulated(membershipCapBody)) {
                for(let memcap of membershipCapBody) {
                    let mc = new MembershipCap();                          
                    
                    mc.id = memcap.membershipCapId;
                    mc.organisationId = ORGANISATION_ID;
                    mc.yearRefId = yearRefId;
                    if (isNullOrZero(mc.id)) {
                        mc.createdBy = userId;
                    } 
                    else {
                        mc.updatedBy = userId;
                        mc.updatedOn = new Date();
                    }
                    mc.isDeleted = 0;
                            
                    let mcRes = await this.membershipCapService.createOrUpdate(mc);
                    memCapMap.set(mcRes.id, mcRes);
                                                            
                    let mcpExistRecord = await this.membershipCapProductService.getMembershipCapProductData(mcRes.id); 

                    if(isArrayPopulated(memcap.products)) {
                        for(let prod of memcap.products) {
                            let mcp = new MembershipCapProduct();
                            let membershipProduct = await this.membershipProductService.findProductByUniqueId(prod.membershipProductId)
                            mcp.id = prod.membershipCapProductId;
                            mcp.membershipCapId = mcRes.id;
                            mcp.membershipProductId = membershipProduct[0].id;
                            if (isNullOrZero(mcp.id)) {
                                mcp.createdBy = userId;
                            } 
                            else {
                                mcp.updatedBy = userId;
                                mcp.updatedOn = new Date();
                            }
                            mcp.isDeleted = 0;
                                
                            let mcpRes = await this.membershipCapProductService.createOrUpdate(mcp);
                            memCapProdMap.set(mcpRes.id, mcpRes);
                        }
                    }
                        
                    if(isArrayPopulated(mcpExistRecord)) {
                        for(let item of mcpExistRecord) {
                            if(memCapProdMap.get(item.id) == undefined) {
                                item.isDeleted = 1;
                                item.updatedBy = userId;
                                item.updatedOn = new Date()
                                await this.membershipCapProductService.createOrUpdate(item);
                            }
                        }
                    }

                    let mfcExistRecord = await this.membershipFeeCapService.getMembershipFeeCapData(mcRes.id);
                    
                    if(isArrayPopulated(memcap.feeCaps)) {  
                        for(let feecap of memcap.feeCaps) {
                            let mfc = new MembershipFeeCap();
                            mfc.id = feecap.membershipFeeCapId;
                            mfc.membershipCapId = mcRes.id;
                            mfc.dobFrom = feecap.dobFrom;
                            mfc.dobTo = feecap.dobTo;
                            mfc.amount = feecap.amount;
                            if (isNullOrZero(mfc.id)) {
                                mfc.createdBy = userId;
                            } 
                            else {
                                mfc.updatedBy = userId;
                                mfc.updatedOn = new Date();
                            }
                            mfc.isDeleted = 0;
                                        
                            let mfcData = await this.membershipFeeCapService.createOrUpdate(mfc);
                            memFeeCapMap.set(mfcData.id, mfcData);                       
                        }
                    }

                    if(isArrayPopulated(mfcExistRecord)) {
                        for(let item of mfcExistRecord) {
                            if(memFeeCapMap.get(item.id) == undefined) {
                                item.isDeleted = 1;
                                item.updatedBy = userId;
                                item.updatedOn = new Date()
                                await this.membershipFeeCapService.createOrUpdate(item);
                            }
                        }
                    }
                }
            }

            if(isArrayPopulated(mcExistRecord)) {
                for(let item of mcExistRecord) {
                    if(memCapMap.get(item.id) == undefined) {
                        await this.membershipCapService.membershipCapDelete(item.id, userId);
                        await this.membershipCapProductService.membershipCapProductDelete(item.id, userId);
                        await this.membershipFeeCapService.membershipFeeCapDelete(item.id, userId);
                    }
                }
            }
            return response.status(200).send("Successfully inserted...");
        }
        
        catch(e) {
            throw e;
        }
    }

    @Authorized()
    @Get('/membershipcap')
    async getMembershipCap(
    //@Body() membershipCapBody: any,
    @HeaderParam("authorization") currentUser: User,
    @QueryParam("organisationUniqueKey") organisationUniqueKey: string,
    @QueryParam("yearRefId") yearRefId: number,
    @Res() response: Response): Promise<any> {
        try {
            //let userId = currentUser.id;
            const ORGANISATION_ID = await this.organisationService.findByUniquekey(organisationUniqueKey);
            let mcExistRecord = await this.membershipCapService.getMembershipCapWithYearRefId(ORGANISATION_ID, yearRefId);
            let responseArr = [];
            if(isArrayPopulated(mcExistRecord)) {
                for(let memCap of mcExistRecord) {
                    let mcObj = {
                        membershipCapId : memCap.id,
                        organisationUniqueKey : organisationUniqueKey,
                        yearRefId : yearRefId,
                        isAllMembershipProduct : 0,
                        products:[],
                        feeCaps:[]
                    }
                    let mcpExistRecord = await this.membershipCapProductService.getMembershipCapProductData(mcObj.membershipCapId);
                    
                    if(isArrayPopulated(mcpExistRecord)) {
                        for(let memProd of mcpExistRecord) {
                            let membershipProduct = await this.membershipProductService.findById(memProd.membershipProductId)
                            let mcpObj = {
                                membershipCapProductId : memProd.id,
                                membershipProductId : membershipProduct.membershipProductUniqueKey
                            }
                            mcObj.products.push(mcpObj);
                        }
                    }
                    else {
                        mcObj.isAllMembershipProduct = 1;
                        //delete mcObj.products
                    }
                    let mfcExistRecord = await this.membershipFeeCapService.getMembershipFeeCapData(mcObj.membershipCapId);

                    if(isArrayPopulated(mfcExistRecord)) {
                        for(let memFeeCap of mfcExistRecord) {
                            let mfcObj = {
                                membershipFeeCapId : memFeeCap.id,
                                dobFrom : memFeeCap.dobFrom,
                                dobTo : memFeeCap.dobTo,
                                amount : memFeeCap.amount
                            }
                            mcObj.feeCaps.push(mfcObj);
                        }
                    }
                    responseArr.push(mcObj);
                }
            }
            return response.status(200).send(responseArr);
        }

        catch(e) {
            throw e;
        }
    }
    
}