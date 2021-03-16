import { Response } from 'express';
import { Authorized, Body, Delete, Get, HeaderParam, JsonController, Param, Post, QueryParam, Res } from 'routing-controllers';
import { logger } from '../logger';
import { MembershipProduct } from '../models/registrations/MembershipProduct';
import { MembershipProductFees } from '../models/registrations/MembershipProductFees';
import { MembershipProductType } from '../models/registrations/MembershipProductType';
import { MembershipProductTypeChildDiscount } from '../models/registrations/MembershipProductTypeChildDiscount';
import { MembershipProductTypeDiscount } from '../models/registrations/MembershipProductTypeDiscount';
import { MembershipProductTypeDiscountType } from '../models/registrations/MembershipProductTypeDiscountType';
import { MembershipProductTypeMapping } from '../models/registrations/MembershipProductTypeMapping';
import { User } from '../models/security/User';
import { ArrayIsEmpty, isArrayPopulated, isNullOrZero, paginationData, PagingData, stringTOFloatNumber, stringTONumber, uuidv4 } from "../utils/Utils";
import AppConstants from '../validation/AppConstants';
import { BaseController } from './BaseController';

@JsonController('/api')
export class MembershipProductController extends BaseController {

    @Authorized()
    @Post('/membershipproduct')
    async createMembershipProduct(
        @Body() membershipProductBody: any,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response): Promise<any> {
        let userId = currentUser.id;
        try {
            if (organisationUniqueKey) {
                // let ORG_LEVEL_ID: number = 0;

                const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);

                if (getOrgDetail) {
                    const ORGANISATION_ID = getOrgDetail.id;
                    const ORG_LEVEL_ID = getOrgDetail.organisationTypeRefId;

                // state and national orgLevel can create
                if (ORG_LEVEL_ID === 1 || ORG_LEVEL_ID === 2) {
                    // guid unique key
                    // if membershipProductTypes is an array , proceed forward
                    let mp = new MembershipProduct();
                    let mpt = new MembershipProductType();
                    let mptMapping = new MembershipProductTypeMapping();
                    if (isArrayPopulated(membershipProductBody.membershipProductTypes)) {
                        let MembershipData;
                        const membershipProductUniqueKeyEDIT = membershipProductBody.membershipProductId;
                        if (membershipProductBody.membershipProductId == '') {
                            // creation mode
                            membershipProductBody.membershipProductId = 0;
                            mp.membershipProductUniqueKey = uuidv4();
                        } else {
                            // edit mode
                            const foundMemPro = await this.membershipProductService.findProductByUniqueId(membershipProductBody.membershipProductId);
                            if (isArrayPopulated(foundMemPro)) {
                                membershipProductBody.membershipProductId = foundMemPro[0].id;
                                // fetch the previous types of the product as it is the returning user with same or different membershipProduct Type
                                const userTypesPrevious = await this.membershipProductTypeMappingService.getMembershipProductTypes(foundMemPro[0].id, ORGANISATION_ID);
                                const TYPES_ID = [];
                                for (let i of userTypesPrevious) {
                                    TYPES_ID.push(i['membershipProductTypeId'])
                                }

                                if (isArrayPopulated(membershipProductBody.membershipProductTypes)) {
                                    for (let type of membershipProductBody.membershipProductTypes) {
                                        // if (type.membershipProductTypeMappingId !== 0 && (membershipProductBody.membershipProductId !== null || membershipProductBody.membershipProductId !== '')) {
                                            TYPES_ID.forEach(async e => {
                                                const index = membershipProductBody.membershipProductTypes.findIndex(g => g.membershipProductTypeRefId === e);
                                                if (index !== -1) {
                                                    // membershipProductBody.membershipProductTypes.splice(index, 1);
                                                    // userTypesPrevious.splice(index, 1);
                                                    // TYPES_ID.splice(index, 1);
                                                } else {
                                                    // user deleted some types 
                                                    const MEMBERSHIP_PRODUCTID = foundMemPro[0].id;
                                                    // const checkIndex = membershipProductBody.membershipProductTypes.indexOf(e);

                                                    const checkmemProUsed = await this.competitionMembershipProductService.checkMemProUsed(MEMBERSHIP_PRODUCTID);

                                                    if (!isArrayPopulated(checkmemProUsed)) {
                                                        let deleteInDiscountChild;
                                                        let deleteInDiscountType;
                                                        let deleteInDiscount;
                                                        let deleteFees;
                                                        let deleteInMapping;
                                                        let deleteInMemProType;

                                                        const getIDForDeleteInDiscountChild = await this.membershipProductTypeChildDiscountService.getIDForDeleteProductByMappingIdInDiscountChild(e, MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                                        if (ArrayIsEmpty(getIDForDeleteInDiscountChild)) {

                                                            for(let i of getIDForDeleteInDiscountChild) {
                                                                let memprotypechild = new MembershipProductTypeChildDiscount();
                                                                memprotypechild.id = i.id;
                                                                memprotypechild.isDeleted = 1;
                                                                deleteInDiscountChild = await this.membershipProductTypeChildDiscountService.createOrUpdate(memprotypechild)
                                                            }
                                                        }

                                                        const getIDForDeleteInDiscountType = await this.membershipProductTypeDiscountTypeService.getIDForDeleteProductByMappingIdInDiscountType(e, MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                                        
                                                        if (ArrayIsEmpty(getIDForDeleteInDiscountType)) {
                                                            for(let i of getIDForDeleteInDiscountType) {
                                                                const memprodistype = new MembershipProductTypeDiscountType();
                                                                memprodistype.id = i.id;
                                                                memprodistype.isDeleted = 1;
                                                                deleteInDiscountType = await this.membershipProductTypeDiscountTypeService.createOrUpdate(memprodistype);
                                                            }
                                                        }

                                                        const getIDForDeleteInDiscount = await this.membershipProductTypeDiscountService.getIDForDeleteProductByMappingIdInDiscount(e, MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                                        if (ArrayIsEmpty(getIDForDeleteInDiscount)) {

                                                            for(let i of getIDForDeleteInDiscount) {
                                                                const memprodis = new MembershipProductTypeDiscount();
                                                                memprodis.id = i.id;
                                                                memprodis.isDeleted = 1;
                                                                deleteInDiscount = await this.membershipProductTypeDiscountService.createOrUpdate(memprodis);
                                                            }
                                                        }

                                                        const getIDForDeleteFees = await this.membershipProductFeesService.getIDForDeleteProductFeesByMappingID(e, MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                                        if (ArrayIsEmpty(getIDForDeleteFees)) {
                                                            
                                                            for(let i of getIDForDeleteFees) {
                                                                const memprofee = new MembershipProductFees();
                                                                memprofee.id = i.id;
                                                                memprofee.isDeleted = 1;
                                                                deleteFees = await this.membershipProductFeesService.createOrUpdate(memprofee);
                                                            }
                                                        }

                                                        const getIDForDeleteInMapping = await this.membershipProductTypeMappingService.getIDForDeleteProductByTypeIdInMapping(e, MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                                        if (ArrayIsEmpty(getIDForDeleteInMapping)) {
                                                            let mappingArray=[]
                                                            for(let i of getIDForDeleteInMapping) {
                                                                const mapping_ = new MembershipProductTypeMapping();
                                                                mapping_.id = i.id;
                                                                mapping_.isDeleted = 1;
                                                                mapping_.membershipProductTypeId = i.membershipProductTypeId;
                                                                mapping_.membershipProductId = i.membershipProductId;
                                                                mappingArray.push(mapping_);
                                                            }
                                                            console.log('mappingArray  :::: ',mappingArray)
                                                            deleteInMapping = await this.membershipProductTypeMappingService.batchCreateOrUpdate(mappingArray);
                                                        }

                                                        const getIDForDeleteInMemProType = await this.membershipProductTypeService.getIDForDeleteProductByTypeIdInTypes(e, MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                                        if (ArrayIsEmpty(getIDForDeleteInMemProType)) {

                                                            for(let i of getIDForDeleteInMemProType) {
                                                                const mptype = new MembershipProductType();
                                                                mptype.id = i.id;
                                                                mptype.isDeleted = 1;
                                                                deleteInMemProType = await this.membershipProductTypeService.createOrUpdate(mptype);
                                                            }
                                                        }

                                                        const allDeleted = await Promise.all([deleteInDiscountChild, deleteInDiscountType, deleteInDiscount, deleteFees, deleteInMapping, deleteInMemProType])

                                                        if (allDeleted) { }
                                                        if (deleteInDiscountChild && deleteInDiscountType && deleteInDiscount && deleteFees && deleteInMapping && deleteInMemProType) {
                                                            MembershipData = await this.getMembershipProductDataAfterSaving(memProID, mpCreate.id, ORGANISATION_ID);
                                                        }
                                                    } else {
                                                        return response.status(212).send({
                                                            errorCode: 8,
                                                            message: 'Cannot delete Membership Product with provided ID, as it is being used in Competition Membership Product'
                                                        })
                                                    }
                                                }
                                            });

                                            if (isArrayPopulated(membershipProductBody.membershipProductTypes)) {
                                                // user added new types
                                                MembershipData = await this.getMembershipProductDataAfterSaving(membershipProductBody.membershipProductId, foundMemPro, ORGANISATION_ID);
                                            }
                                        // }
                                    }
                                }
                            } else {
                                return response.status(212).send({
                                    errorCode: 5,
                                    message: 'Cannot find Membership Product with provided ID'
                                })
                            }

                        }

                        mp.id = membershipProductBody.membershipProductId
                        mp.productName = membershipProductBody.membershipProductName;
                        mp.organisationId = ORGANISATION_ID;
                        if (isNullOrZero(mp.id)) {
                            mp.createdBy = userId;
                        } else {
                            mp.updatedBy = userId;
                            mp.updatedOn = new Date();
                        }

                        mp.statusRefId = membershipProductBody.statusRefId;
                        mp.yearRefId = membershipProductBody.yearRefId;
                        mp.membershipProductValidityRefId = membershipProductBody.validityRefId;
                        const mpCreate = await this.membershipProductService.createOrUpdate(mp);

                        // fetching isDefault true
                        const getDefaultTypes = await this.membershipProductTypeService.getDefaultMembershipProductTypes(1);

                        let defaultTypesID = []
                        if (Array.isArray(getDefaultTypes) && getDefaultTypes.length > 0) {
                            for (let i of getDefaultTypes) defaultTypesID.push(i.id)
                        }

                        mptMapping.membershipProductId = mpCreate.id;

                        if (isArrayPopulated(membershipProductBody.membershipProductTypes)) {
                            for (let type of membershipProductBody.membershipProductTypes) {
                                mptMapping.id = type.membershipProductTypeMappingId;
                                mptMapping.dobFromDate = type.dobFrom;
                                mptMapping.dobToDate = type.dobTo;
                                mptMapping.allowTeamRegistrationTypeRefId = type.allowTeamRegistrationTypeRefId;
                                mptMapping.isChildrenCheckNumber = type.isChildrenCheckNumber;
                                if (type.membershipProductTypeRefId === 0 || membershipProductBody.membershipProductId !== '') {
                                    mpt.id = type.membershipProductTypeRefId;
                                    mpt.membershipProductId = mpCreate.id;

                                    if (isNullOrZero(mpt.id)) {
                                        mpt.createdBy = userId;
                                    } else {
                                        mpt.updatedBy = userId;
                                        mpt.updatedOn = new Date();
                                    }

                                    mpt.isDefault = 0; // false
                                    mpt.isPlaying = type.isPlaying;
                                    mpt.name = type.membershipProductTypeRefName;
                                }

                                if (isNullOrZero(mptMapping.id)) {
                                    mptMapping.createdBy = userId;
                                } else {
                                    mptMapping.updatedBy = userId;
                                    mptMapping.updatedOn = new Date();
                                }

                                let mptData;
                                if (defaultTypesID.indexOf(type.membershipProductTypeRefId) === -1) {
                                    mptData = await this.membershipProductTypeService.createOrUpdate(mpt)
                                }
                                mptMapping.membershipProductTypeId = type.membershipProductTypeRefId == 0 ? mptData.id : type.membershipProductTypeRefId;
                                await this.membershipProductTypeMappingService.createOrUpdate(mptMapping)
                            }
                        }

                        let memProID;

                        if (membershipProductBody.membershipProductId == '') {
                            memProID = mpCreate.membershipProductUniqueKey;
                        } else {
                            memProID = membershipProductUniqueKeyEDIT
                        }

                      

                        MembershipData = await this.getMembershipProductDataAfterSaving(memProID, mpCreate.id, ORGANISATION_ID);

                        response.status(200).send({
                            id: mpCreate.membershipProductUniqueKey,
                            errorCode: 0,
                            message: 'Membership Product successfully created',
                            data: await this.getMembershipProductDataAfterSaving(memProID, mpCreate.id, ORGANISATION_ID)
                        });

                    } else {
                        return response.status(212).send({
                            errorCode: 1,
                            message: 'Please pass membership Product in the correct format'
                        })
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: 'Cannot create membership product, Please login wih higher organisation level'
                    })
                }

                } else {
                    return response.status(212).send({
                        errorCode: 8,
                        message: 'Cannot find organisation with provided ID'
                    })
                }
            } else {
                return response.status(212).send({
                    errorCode: 6,
                    message: 'Please pass organisationUniqueKey as a query parameter'
                })
            }
        } catch (err) {
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save the membership product.' + err : 'Failed to save the membership product.'
            });
        }
    }

   
    @Authorized()
    @Get('/membershipproduct/:membershipProductId')
    async getMembershipProduct(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response,
        @Param("membershipProductId") membershipProductId: string) {
        // let userId = currentUser.id;
        try {
            if (organisationUniqueKey) {
                const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                if(getOrgDetail) {
                    const ORGANISATION_ID = getOrgDetail.id;
                    if (membershipProductId) {
                        const foundProducts = await this.membershipProductService.findProductById(membershipProductId, ORGANISATION_ID);
                        if (foundProducts) {
                            return response.status(200).send(foundProducts)
                        } else {
                            return response.status(212).send({
                                errorCode: 2, message: 'Failed to get Product Details.'
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 1, message: 'Please pass membershipProductId as a Path parameter.'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 7, message: 'Cannot find organisation with provided ID'
                    });                    
                }
            } else {
                return response.status(212).send({
                    errorCode: 6,
                    message: 'Please pass organisationUniqueKey as a query parameter'
                })
            }
        } catch (err) {
            logger.error(`Unable to get Membership Product ` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Membership Product Details.' + err : 'Failed to get Membership Product Details.'
            });
        }
    }

    @Authorized()
    @Get('/membershipproduct/:membershipProductId/fees')
    async getMembershipProductFees(
        @Param("membershipProductId") membershipProductId: string,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            if (membershipProductId) {
                if (organisationUniqueKey) {

                    const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                    if(getOrgDetail) {
                        const ORGANISATION_ID = getOrgDetail.id;
                        const productFound = await this.membershipProductService.findProductByUniqueId(membershipProductId);
    
                        if (isArrayPopulated(productFound)) {
                            const found = await this.membershipProductFeesService.findProductFeesById(productFound[0].id, ORGANISATION_ID);
                            if (isArrayPopulated(found) && found['result'] && found['feeValueData']) {
                                return response.status(200).send(found);
                            } else {
                                return response.status(204).send({
                                    errorCode: 1,
                                    message: "Cannot find MembershipFee Details with provided Membership Product ID"
                                });
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 5,
                                message: 'Cannot find membership product with the provided key'
                            })
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 7,
                            message: "Cannot find organisation with provided ID"
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 6,
                        message: 'Please pass organisationUniqueKey as a query parameter'
                    })
                }
            } else {
                return response.status(212).send({
                    errorCode: 2, message: 'Please pass membershipProductId as a Path parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to get Product Fees ` + err);
            return response.status(400).send({
               err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed lto get Product Fee Details.' + err : 'Failed lto get Product Fee Details.'
            });
        }
    }

    @Authorized()
    @Delete('/membershipproduct/:membershipProductId')
    async deleteMembershipProduct(
        @Param("membershipProductId") membershipProductId: string,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response): Promise<any> {
        // let userId = currentUser.id;
        try {
            if (organisationUniqueKey) {
                if (membershipProductId) {

                    const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                    if(getOrgDetail) {
                        const ORGANISATION_ID = getOrgDetail.id;
                        const foundProduct = await this.membershipProductService.findProductByUniqueId(membershipProductId);
    
                        if (isArrayPopulated(foundProduct)) {
                            const MEMBERSHIP_PRODUCTID = foundProduct[0].id;
                            // check if membershipProduct is used in competitionMembershipProduct
                            const checkmemProUsed = await this.competitionMembershipProductService.checkMemProUsed(MEMBERSHIP_PRODUCTID);
                            if (isArrayPopulated(checkmemProUsed)) {
                                return response.status(200).send({
                                    errorCode: 2,
                                    message: 'cannot delete the product, as it is being used by Competition Membership Product'
                                });
                            } else {
                                let childDelete;
                                let discountTypeDelete;
                                let discountDelete;
                                let feesDelete;
                                let mappingDelete;
                                let memTypeDelete;
                                let memProductDelete;
    
                                // Child Discount
                                const getIDForChildDelete = await this.membershipProductTypeChildDiscountService.getIDForDeleteProductByProductIdInChildDiscount(MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                if (isArrayPopulated(getIDForChildDelete)) {
                                    let memprochild = new MembershipProductTypeChildDiscount();
                                    memprochild.id = getIDForChildDelete[0].id;
                                    memprochild.isDeleted = 1;
                                    childDelete = await this.membershipProductTypeChildDiscountService.createOrUpdate(memprochild);
                                }
    
                                // Discount Type
                                const getIDForDiscountTypeDelete = await this.membershipProductTypeDiscountTypeService.getIDForDeleteProductByProductIdInDiscountType(MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                if (isArrayPopulated(getIDForDiscountTypeDelete)) {
                                    let mptdt = new MembershipProductTypeDiscountType();
                                    mptdt.id = getIDForDiscountTypeDelete[0].id;
                                    mptdt.isDeleted = 1;
                                    discountTypeDelete = await this.membershipProductTypeDiscountTypeService.createOrUpdate(mptdt)
                                }
    
                                // Discount
                                const getIDForDiscountDelete = await this.membershipProductTypeDiscountService.getIDForDeleteProductByProductIdInDiscount(MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                if (isArrayPopulated(getIDForDiscountDelete)) {
                                    let memprodis = new MembershipProductTypeDiscount()
                                    memprodis.id = getIDForDiscountDelete[0].id;
                                    memprodis.isDeleted = 1;
                                    discountDelete = await this.membershipProductTypeDiscountService.createOrUpdate(memprodis);
                                }
    
                                // Fees
                                const getIDForFeesDelete = await this.membershipProductFeesService.getDetailsForDeleteProductByProductIdInFees(MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                if (isArrayPopulated(getIDForFeesDelete)) {
                                    let mpfees = new MembershipProductFees();
                                    mpfees.id = getIDForFeesDelete[0].id;
                                    mpfees.isDeleted = 1;
                                    feesDelete = await this.membershipProductFeesService.createOrUpdate(mpfees)
                                }
    
                                // Mapping
                                const getMappingDetails = await this.membershipProductTypeMappingService.getIDForDeleteProductByProductIdInMapping(MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                if (isArrayPopulated(getMappingDetails)) {
                                    let mapping = new MembershipProductTypeMapping();
                                    mapping.id = getMappingDetails[0].id;
                                    mapping.isDeleted = 1;
                                    mappingDelete = await this.membershipProductTypeMappingService.createOrUpdate(mapping);
                                }
    
                                // Types
                                const getDetailsForMemTypeDelete = await this.membershipProductTypeService.getDetailsForDeleteProductByProductIdInType(MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                if (isArrayPopulated(getDetailsForMemTypeDelete)) {
                                    let mpt = new MembershipProductType();
                                    mpt.id = getDetailsForMemTypeDelete[0].id;
                                    mpt.isDeleted = 1;
                                    memTypeDelete = await this.membershipProductTypeService.createOrUpdate(mpt);
                                }
    
                                // MembershipProduct
                                const getIDForMemProductDelete = await this.membershipProductService.getIDForDeleteProductByProductId(MEMBERSHIP_PRODUCTID, ORGANISATION_ID);
                                if (isArrayPopulated(getIDForMemProductDelete)) {
                                    let mp = new MembershipProduct();
                                    mp.id = getIDForMemProductDelete[0].id;
                                    mp.isDeleted = 1;
                                    memProductDelete = await this.membershipProductService.createOrUpdate(mp)
                                }
    
                                const deleteProduct = await Promise.all([childDelete, discountTypeDelete, discountDelete, feesDelete, mappingDelete, memTypeDelete, memProductDelete]);
    
                                if (deleteProduct) {
                                    return response.status(200).send({
                                        errorCode: 0,
                                        message: 'Successfully deleted the product'
                                    });
                                }
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: 'This Product has already been deleted'
                            })
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 7,
                            message: 'cannot find the organisation with the provided ID'
                        });
                    }
                } else {
                    return response.status(400).send({
                        errorCode: 1, message: 'Please pass membershipProductId as a Path parameter.'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 6,
                    message: 'Please pass organisationUniqueKey as a query parameter'
                })
            }
        } catch (err) {
            logger.error(`Unable to delete membership product ` + err);
            return response.status(400).send({
               err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to delete the membership product.' + err : 'Failed to delete the membership product.'
            });
        }
    }

    @Authorized()
    @Post('/membershipproduct/fees')
    async createProductFees(
        @Body() mpFeeBody,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        let userId = currentUser.id;
        try {
            if (organisationUniqueKey) {
                let ORG_LEVEL_ID: number = 0;
                const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);

                if (getOrgDetail) {
                    ORG_LEVEL_ID = getOrgDetail.organisationTypeRefId;
                    const ORGANISATION_ID = getOrgDetail.id;
                    // state and national orgLevel can create
                    if (ORG_LEVEL_ID === 1 || ORG_LEVEL_ID === 2) {
                        const recordFound = await this.membershipProductService.findProductByUniqueId(mpFeeBody.membershipProductId);
                        let mpfeeData = new MembershipProductFees();
                        if (!isArrayPopulated(recordFound)) {
                            return response.status(212).json({
                                id: 0,
                                errorCode: 1,
                                message: 'Record with provided membershipProductId doesnot exists'
                            })
                        } else {
                            mpfeeData.membershipProductId = recordFound[0].id;
                        }
                        let mp = new MembershipProduct();
                        mp.id = recordFound[0].id;
                        mp.paymentOptionRefId
                        await this.membershipProductService.createOrUpdate(mp);
                        if (isArrayPopulated(mpFeeBody.membershipFees)) {
                            for (let fee of mpFeeBody.membershipFees) {
                                mpfeeData.id = fee.membershipProductFeesId;

                                if (isNullOrZero(mpfeeData.id)) {
                                    mpfeeData.createdBy = userId;
                                } else {
                                    mpfeeData.updatedBy = userId;
                                    mpfeeData.updatedOn = new Date();
                                }

                                mpfeeData.membershipProductTypeMappingId = fee.membershipProductTypeMappingId;
                                mpfeeData.casualFee = stringTOFloatNumber(fee.casualFee);
                                mpfeeData.casualGst = stringTOFloatNumber(fee.casualGst);
                                mpfeeData.seasonalFee = stringTOFloatNumber(fee.seasonalFee);
                                mpfeeData.seasonalGst = stringTOFloatNumber(fee.seasonalGst);
                                mpfeeData.membershipProductFeesTypeRefId = fee.membershipProductFeesTypeRefId;
                                mpfeeData.organisationId = ORGANISATION_ID;
                                mpfeeData.validityDays = fee.validityDays;
                                mpfeeData.extendEndDate = fee.extendEndDate;

                                await this.membershipProductFeesService.createOrUpdate(mpfeeData)
                            }

                            const MembershipData = await this.getMembershipProductDataAfterSaving(mpFeeBody.membershipProductId, mpfeeData.membershipProductId, ORGANISATION_ID)

                            return response.status(200).send({
                                errorCode: 0,
                                message: 'Membership Product Fees successfully created',
                                data: MembershipData
                            })
                        } else {
                            return response.status(212).send({
                                errorCode: 3,
                                message: 'Please pass membershipProductFees in the correct format'
                            })
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 2,
                            message: 'Cannot create membership product, Please login wih higher organisation level'
                        })
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 7,
                        message: 'cannot find the organisation with the provided ID'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 6,
                    message: 'Please pass organisationUniqueKey as a query parameter'
                })
            }
        } catch (err) {
            logger.error(`Unable to save membership product fee with productId ${mpFeeBody.membershipProductId}` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save the membership product fees.' : err + 'Failed to save the membership product fees.'
            });
        }
    }

    @Authorized()
    @Post('/membershipproduct/discount')
    async createProductDiscount(
        @Body() mpDiscountBody,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        let userId = currentUser.id;
        try {
            if (organisationUniqueKey) {
                let ORG_LEVEL_ID: number = 0;

                const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                const ORGANISATION_ID = getOrgDetail.id;

                if (getOrgDetail) {
                    ORG_LEVEL_ID = getOrgDetail.organisationTypeRefId;
                    // state and national orgLevel can create
                    if (ORG_LEVEL_ID === 1 || ORG_LEVEL_ID === 2) {
                        const recordFound = await this.membershipProductService.findProductByUniqueId(mpDiscountBody.membershipProductId)
                        let mpDiscountData = new MembershipProductTypeDiscount();
                        let memprotypedisctype = new MembershipProductTypeDiscountType();
                        let membershipProductId = null;

                        if (!isArrayPopulated(recordFound)) {
                            return response.status(212).json({
                                id: 0,
                                errorCode: 1,
                                message: 'Record with provided membershipProductId doesnot exists'
                            })
                        } else {
                            membershipProductId = recordFound[0].id;
                        }

                        if (membershipProductId) {
                            if (isArrayPopulated(mpDiscountBody.membershipProductDiscounts)) {
                                let discountid;
                                let previousDiscountId = []
                                let previousDiscountTypeId = []
                                let previousDiscountChildId = []

                                // get the previous discount types and discounts and child discount
                                const previousDiscountData = await this.membershipProductTypeDiscountService.findPreviousDiscountData(membershipProductId, ORGANISATION_ID)
                                const previousDiscountTypeData = await this.membershipProductTypeDiscountTypeService.findPreviousDiscountTypeData(membershipProductId, ORGANISATION_ID)
                                const previousDiscountTypeChildData = await this.membershipProductTypeChildDiscountService.findPreviousDiscountTypeChildData(membershipProductId, ORGANISATION_ID)

                                if (isArrayPopulated(previousDiscountData)) {
                                    for (let i of previousDiscountData) {
                                        previousDiscountId.push(i.id)
                                    }
                                }

                                if (isArrayPopulated(previousDiscountTypeChildData)) {
                                    for (let i of previousDiscountTypeChildData) {
                                        previousDiscountChildId.push(i.id)
                                    }
                                }

                                if (isArrayPopulated(previousDiscountTypeData)) {
                                    for (let i of previousDiscountTypeData) {
                                        previousDiscountTypeId.push(i.id)
                                    }
                                }

                                let membershipProductData;
                                if (isArrayPopulated(mpDiscountBody.membershipProductDiscounts)) {
                                    for (let discount of mpDiscountBody.membershipProductDiscounts) {

                                        // fetching default membershipProductTypeDiscountType
                                        const getDiscountDefaultTypes: MembershipProductTypeDiscountType[] = await this.membershipProductTypeDiscountTypeService.getDefaultDiscountTypes(1);
                                        let DefaultDiscountID = []

                                        if (isArrayPopulated(getDiscountDefaultTypes)) {
                                            for (let j of getDiscountDefaultTypes) {
                                                DefaultDiscountID.push(j.id)
                                            }
                                        }

                                        // check if previous membership product discount types is same as the current one
                                        // if yes the proceed else delete the previous one
                                        let deleteDiscount;
                                        let deleteDiscountType;
                                        let deleteDiscountChild;

                                        if (isArrayPopulated(previousDiscountChildId) || isArrayPopulated(previousDiscountId) || isArrayPopulated(previousDiscountTypeId)) {
                                            if (isArrayPopulated(previousDiscountChildId)) {
                                                previousDiscountChildId.forEach(async e => {
                                                    if (isArrayPopulated(discount.discounts)) {
                                                        const index = discount.discounts.findIndex(g => {
                                                            if (isArrayPopulated(g.childDiscounts)) {
                                                                for (let c of g.childDiscounts) {
                                                                    if (c !== 0) {
                                                                        return c.membershipFeesChildDiscountId === e
                                                                    }
                                                                }
                                                            }
                                                            return g;
                                                        });
                                                        if (index !== -1) {
                                                            previousDiscountChildId.splice(index, 1);
                                                        } else {
                                                            // user deleted some child discounts 

                                                            // deleteDiscountChild = await this.membershipProductTypeChildDiscountService.getIDForDeleteProductByIdInDiscountChild(e, userId);
                                                            let childDis = new MembershipProductTypeChildDiscount();
                                                            childDis.isDeleted = 1;
                                                            childDis.id = e;
                                                            deleteDiscountChild = await this.membershipProductTypeChildDiscountService.createOrUpdate(childDis);
                                                        }
                                                    } else {
                                                        // deleteDiscountChild = await this.membershipProductTypeChildDiscountService.deleteProductByIdInDiscountChild(e, userId);
                                                        let childDis = new MembershipProductTypeChildDiscount();
                                                        childDis.isDeleted = 1;
                                                        childDis.id = e;
                                                        deleteDiscountChild = await this.membershipProductTypeChildDiscountService.createOrUpdate(childDis);
                                                    }
                                                });
                                            }

                                            if (isArrayPopulated(previousDiscountTypeId)) {
                                                previousDiscountTypeId.forEach(async e => {
                                                    if (isArrayPopulated(discount.discounts)) {
                                                        const index = discount.discounts.findIndex(g => g.membershipPrdTypeDiscountTypeRefId === e);
                                                        if (index !== -1) {
                                                            previousDiscountTypeId.splice(index, 1);
                                                        } else {
                                                            // user deleted some discount types
                                                            DefaultDiscountID.forEach(async f => {
                                                                if (f !== e) {
                                                                    // deleteDiscountType = await this.membershipProductTypeDiscountTypeService.deleteProductByIdInDiscountType(e, userId);
                                                                    let memprodiscounttype = new MembershipProductTypeDiscountType();
                                                                    memprodiscounttype.id = e;
                                                                    memprodiscounttype.isDeleted = 1;
                                                                    deleteDiscountType = await this.membershipProductTypeDiscountTypeService.createOrUpdate(memprodiscounttype);
                                                                }
                                                            })
                                                        }
                                                    } else {
                                                        // deleteDiscountType = await this.membershipProductTypeDiscountTypeService.deleteProductByIdInDiscountType(e, userId);
                                                        let memprodiscounttype = new MembershipProductTypeDiscountType();
                                                        memprodiscounttype.id = e;
                                                        memprodiscounttype.isDeleted = 1;
                                                        deleteDiscountType = await this.membershipProductTypeDiscountTypeService.createOrUpdate(memprodiscounttype);
                                                    }
                                                });
                                            }

                                            if (isArrayPopulated(previousDiscountId)) {
                                                previousDiscountId.forEach(async e => {
                                                    if (isArrayPopulated(discount.discounts)) {
                                                        const index = discount.discounts.findIndex(g => g.membershipProductTypeDiscountId === e);
                                                        if (index !== -1) {
                                                            previousDiscountId.splice(index, 1);
                                                        } else {
                                                            // user deleted some discounts 
                                                            // deleteDiscount = await this.membershipProductTypeDiscountService.deleteProductByIdInDiscount(e, userId);
                                                            let mpd = new MembershipProductTypeDiscount();
                                                            mpd.id = e;
                                                            mpd.isDeleted = 1;
                                                            deleteDiscount = await this.membershipProductTypeDiscountService.createOrUpdate(mpd);
                                                        }
                                                    } else {
                                                        // deleteDiscount = await this.membershipProductTypeDiscountService.deleteProductByIdInDiscount(e, userId);
                                                        let mpd = new MembershipProductTypeDiscount();
                                                        mpd.id = e;
                                                        mpd.isDeleted = 1;
                                                        deleteDiscount = await this.membershipProductTypeDiscountService.createOrUpdate(mpd);
                                                    }
                                                });
                                            }

                                            const deleteDiscounts = await Promise.all([deleteDiscountChild, deleteDiscountType, deleteDiscount])
                                            if (deleteDiscount && deleteDiscountChild && deleteDiscountType) {
                                                membershipProductData = []
                                            }
                                        }

                                        if (isArrayPopulated(discount.discounts)) {
                                            for (let d of discount.discounts) {

                                                mpDiscountData.membershipProductTypeMappingId = d.membershipProductTypeMappingId;
                                                mpDiscountData.id = d.membershipProductTypeDiscountId;

                                                if (d.amount !== null && d.amount !== undefined) {
                                                    mpDiscountData.percentageOffOrFixedAmount = d.amount;
                                                }

                                                if (isNullOrZero(mpDiscountData.id)) {
                                                    mpDiscountData.createdBy = userId;
                                                } else {
                                                    mpDiscountData.updatedBy = userId;
                                                    mpDiscountData.updatedOn = new Date();
                                                }

                                                mpDiscountData.description = d.description;
                                                mpDiscountData.availableFrom = d.availableFrom;
                                                mpDiscountData.availableTo = d.availableTo;
                                                mpDiscountData.discountCode = d.discountCode;
                                                mpDiscountData.applyDiscount = d.applyDiscount;
                                                mpDiscountData.question = d.question;
                                                mpDiscountData.discountTypeRefId = d.discountTypeRefId;
                                                if (d.membershipPrdTypeDiscountTypeRefId === 0) {
                                                    memprotypedisctype.name = d.membershipPrdTypeDiscountTypeName;
                                                    memprotypedisctype.description = d.membershipPrdTypeDiscountTypeDesc;
                                                    memprotypedisctype.membershipProductId = membershipProductId;
                                                    memprotypedisctype.createdBy = userId;
                                                    memprotypedisctype.isDefault = 0; // false
                                                }

                                                let mptdtData;
                                                if (DefaultDiscountID.indexOf(d.membershipPrdTypeDiscountTypeRefId) === -1) {
                                                    mptdtData = await this.membershipProductTypeDiscountTypeService.createOrUpdate(memprotypedisctype);
                                                }

                                                if (d.membershipPrdTypeDiscountTypeRefId == 0) {
                                                    mpDiscountData.membershipProductTypeDiscountTypeId = mptdtData.id
                                                } else {
                                                    mpDiscountData.membershipProductTypeDiscountTypeId = d.membershipPrdTypeDiscountTypeRefId
                                                }

                                                const discountCreated = await this.membershipProductTypeDiscountService.createOrUpdate(mpDiscountData);

                                                if (isArrayPopulated(d.childDiscounts)) {
                                                    this.createChildDiscount(d.childDiscounts, userId, discountCreated.id)
                                                }
                                                discountid = discountCreated.id

                                            }
                                        }
                                    }
                                }
                                if(recordFound[0].statusRefId == 1 ){
                                    let actions = await this.actionsService.checkMembershipActionPresent(membershipProductId);
                                    if(actions == null || actions == undefined){
                                        let actionArray = await this.actionsService.createAction11( ORGANISATION_ID, membershipProductId, userId)
                                        await this.actionsService.batchCreateOrUpdate(actionArray)
                                    }
                                }
                                if (mpDiscountBody.statusRefId) {
                                    await this.membershipProductService.UpdateProductStatus(ORGANISATION_ID, membershipProductId, mpDiscountBody.statusRefId);
                                }
                               
                                const MembershipData = await this.getMembershipProductDataAfterSaving(mpDiscountBody.membershipProductId, membershipProductId, ORGANISATION_ID);

                                return response.status(200).send({
                                    errorCode: 0,
                                    message: 'Membership Product Discount successfully created',
                                    data: MembershipData
                                })
                            } else {
                                return response.status(200).send({
                                    errorCode: 3,
                                    message: `No Discount created against membership Product with ID ${mpDiscountBody.membershipProductId}`
                                })
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: 'Cannot find the Product with provided ID'
                            })
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 2,
                            message: 'Cannot create membership product, Please login wih higher organisation level'
                        })
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 7,
                        message: 'Cannot find organisation with the provided ID'
                    })
                }
            } else {
                return response.status(212).send({
                    errorCode: 6,
                    message: 'Please pass organisationUniqueKey as a query parameter'
                })
            }
        } catch (err) {
            logger.error(`Unable to save membership product discount with productId ${mpDiscountBody.membershipProductId}` + err);
            return response.status(400).send({
               err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save the membership product discount.' + err : 'Failed to save the membership product discount.'
            });
        }
    }

    @Authorized()
    @Get('/membershipproduct/:membershipProductId/discount')
    async getProductDiscount(
        @Param("membershipProductId") membershipProductId: string,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            if (membershipProductId) {
                if (organisationUniqueKey) {

                    let ProductID = null;
                    const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                    if (getOrgDetail) {
                        const ORGANISATION_ID = getOrgDetail.id;
                        const productFound = await this.membershipProductService.findProductByUniqueId(membershipProductId);

                        if (isArrayPopulated(productFound)) {
                            ProductID = productFound[0].id;

                            const foundProductDiscount = await this.membershipProductTypeDiscountService.findProductDiscountById(ProductID, ORGANISATION_ID);
                            return response.status(foundProductDiscount ? 200 : 204).send(foundProductDiscount);

                        } else {
                            logger.error(`Unable to get Product Discount with product ID ${ProductID}`);
                            return response.status(400).send({
                                name: 'unexpected_error', message: 'Failed to get Product Discount Details.'
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 7,
                            message: 'Cannot find organisation with the provided ID'
                        })
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 6,
                        message: 'Please pass organisationUniqueKey as a query parameter'
                    })
                }
            } else {
                return response.status(212).send({
                    errorCode: 2, message: 'Please pass membershipProductId as a Path parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to get Product Discount ` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Product Discount Details.' + err : 'Failed to get Product Discount Details.'
            });
        }
    }

    @Authorized()
    @Get('/membershipproduct/all/:yearRefId')
    async getAllProduct(
        @Param("yearRefId") yearRefId: number,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
                if (organisationUniqueKey) {

                    let ProductID = null;
                    const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                    if (getOrgDetail) {
                        const ORGANISATION_ID = getOrgDetail.id;
                        const products = await this.membershipProductService.findByOrganisationId(ORGANISATION_ID, yearRefId);

                        return response.status(200).send(products)
                    } else {
                        return response.status(212).send({
                            errorCode: 7,
                            message: 'Cannot find organisation with the provided ID'
                        })
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 6,
                        message: 'Please pass organisationUniqueKey as a query parameter'
                    })
                }
           
        } catch (err) {
            logger.error(`Unable to get Product Discount ` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Product Discount Details.' + err : 'Failed to get Product Discount Details.'
            });
        }
    }

    public async createChildDiscount(childDiscount, userId: number, discountID: number) {
        let cd = new MembershipProductTypeChildDiscount();
        cd.sortOrder = null;
        cd.membershipProductTypeDiscountId = discountID.toString();

        for (let c of childDiscount) {
            cd.percentageValue = c.percentageValue;
            cd.id = c.membershipFeesChildDiscountId;

            if (isNullOrZero(cd.id)) {
                cd.createdBy = userId;
            } else {
                cd.updatedBy = userId;
                cd.updatedOn = new Date();
            }

            await this.membershipProductTypeChildDiscountService.createOrUpdate(cd)
        }
    }

    @Authorized()
    @Post('/membershipproductfee/:yearRefId')
    async getProductFeeListing(
        @HeaderParam("authorization") currentUser: User,
        @Body() mpFeePagingBody: PagingData,
        @Param("yearRefId") yearRefId: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('sortBy') sortBy: string=undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC'|'DESC'=undefined,
        @Res() response: Response) {
        // const userId = currentUser.id;
        try {
            if (mpFeePagingBody.paging) {
                if ((mpFeePagingBody.paging.limit !== (null || undefined)) && (mpFeePagingBody.paging.offset !== (null || undefined))) {
                    if (yearRefId) {
                        if (organisationUniqueKey) {
                            const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                            if (getOrgDetail) {
                                const ORGANISATION_ID = getOrgDetail.id;
                                const OFFSET = stringTONumber(mpFeePagingBody.paging.offset);
                                const LIMIT = stringTONumber(mpFeePagingBody.paging.limit);
                                const YEAR = stringTONumber(yearRefId);
                                
                                const getMembershipFeeData = await this.membershipProductFeesService.getProductFeeListing(ORGANISATION_ID, false, OFFSET, LIMIT, YEAR, sortBy, sortOrder);
                                
                                let getCount = getMembershipFeeData[1]
                                let getResult = getMembershipFeeData[0]

                                if (isArrayPopulated(getCount)) {
                                    getCount = getCount[0].productFeeCount
                                }

                                if (isArrayPopulated(getResult)) {
                                    getResult.map(res => {
                                        (res.isDiscountApplicable == 0 || res.isDiscountApplicable == null) ? (res.isDiscountApplicable = false) : (res.isDiscountApplicable = true);
                                        (res.isUsed == 0) ? (res.isUsed = false) : (res.isUsed = true);
                                        return res;
                                    });
                                }

                                let responseObject = paginationData(stringTONumber(getCount), LIMIT, OFFSET)
                                responseObject["membershipFees"] = getResult;

                                response.status(200).send(responseObject)
                            } else {
                                return response.status(212).send({
                                    errorCode: 7,
                                    message: 'Cannot find organisation with the provided ID'
                                })
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 6,
                                message: 'Please pass organisationUniqueKey as a query parameter'
                            })
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 5,
                            message: 'Please pass yearRefId as path parameter for Product Fee Listing'
                        })
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 3,
                        message: 'Please pass offset and limit in correct format for Product Fee Listing'
                    })
                }
            } else {
                return response.status(212).send({
                    errorCode: 4,
                    message: 'Please pass paging in correct format for Product Fee Listing'
                })
            }
        } catch (err) {
            logger.error(`Unable to get Product Fees List` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Product Fees List.' + err : 'Failed to get Product Fees List.'
            });
        }
    }

    @Authorized()
    @Delete('/membershipproductfees/:membershipProductId')
    async deleteMembershipProductFees(
        @Param("membershipProductId") membershipProductId: string,
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response): Promise<any> {
        let userId = currentUser.id;
        try {
            if (membershipProductId) {
                if (organisationUniqueKey) {
                    const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                    if (getOrgDetail) {
                        const ORGANISATION_ID = getOrgDetail.id;
                        const foundProduct = await this.membershipProductService.findProductByUniqueId(membershipProductId)
                        if (isArrayPopulated(foundProduct)) {
                            const deletedData = await this.membershipProductFeesService.getDetailsForDeleteProductByProductIdInFees(foundProduct[0].id, ORGANISATION_ID);
                            if (isArrayPopulated(deletedData)) {
                                let mpf = new MembershipProductFees();
                                mpf.id = deletedData[0].id;
                                mpf.isDeleted = 1;
                                const deleteSuccess = await this.membershipProductFeesService.createOrUpdate(mpf);
                                if (isArrayPopulated(deleteSuccess)) {
                                    return response.status(200).send({
                                        errorCode: 0,
                                        message: 'Membership Product Fees successfully deleted'
                                    });
                                } else {
                                    return response.status(212).send({
                                        errorCode: 4,
                                        message: 'Requested Membership Product Fee is already deleted or doesnot exists'
                                    });
                                }
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 1,
                                message: 'Requested Membership Product Fee doesnot exists'
                            })
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 7,
                            message: 'Cannot find organisation with the provided ID'
                        })
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 6,
                        message: 'Please pass organisationUniqueKey as a query parameter'
                    })
                }
            } else {
                return response.status(212).send({
                    errorCode: 2,
                    message: 'Please pass membershipProductId as a Path parameter'
                })
            }
        } catch (err) {
            logger.error(`Unable to delete membership product fees with productID ${membershipProductId}` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to delete the membership product fees.' + err : 'Failed to delete the membership product fees.'
            });
        }
    }

    @Authorized()
    @Get('/membershipproducttype/default')
    async getDefaultMembershipProductType(
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response): Promise<any> {
        try {
            const foundProductTypes = await this.membershipProductTypeService.getDefaultTypes(1)
            if (isArrayPopulated(foundProductTypes)) {
                return response.status(200).send({
                    membershipproducttypes: foundProductTypes[0],
                    errorCode: 0,
                    message: 'successfully get default Membership Product Type'
                })
            } else {
                return response.status(200).send({
                    membershipproducttypes: foundProductTypes[0],
                    errorCode: 0,
                    message: 'Cannot get default Membership Product Type'
                })
            }
        } catch (err) {
            logger.error(`Unable to get default Membership Product Type` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get default Membership Product types.' + err : 'Failed to get default Membership Product types.'
            });
        }
    }

    @Authorized()
    @Get('/details/membershipproduct/:competitionId')
    async getProductsNameofMemPro(
        @HeaderParam("authorization") currentUser: User,
        @Param("competitionId") competitionId: string,
        @Res() response: Response): Promise<any> {
        try {
            // let userId = currentUser.id;
            const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionId)
            if (isArrayPopulated(foundCompetition)) {
                const foundProductName = await this.membershipProductService.getProductsNameWithTypes(competitionId);
                if (isArrayPopulated(foundProductName)) {
                    for (let i of foundProductName) {
                        if (isArrayPopulated(i['membershipProductTypes'])) i['membershipProductTypes'].map(f => 
                            {
                                f.id = f.divisionId + '_' + f.membershipProductTypeMappingId + '_' +
                                f.isIndividualRegistration + '_' + f.isTeamRegistration;
                            });
                    }
                    return response.status(200).send({
                        id: foundProductName,
                        errorCode: 0,
                        message: 'successfully get default Membership Product Name'
                    })
                } else {
                    return response.status(200).send([])
                    // { errorCode: 1, message: 'Cannot get default Membership Product Name' }
                }
            } else {
                return response.status(212).send({
                    errorCode: 2,
                    message: 'No Competition found with provided ID'
                })
            }
        } catch (err) {
            logger.error(`Unable to get default Membership Product Name` + err);
            return response.status(400).send({
               err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get default Membership Product name.' + err : 'Failed to get default Membership Product name.'
            });
        }
    }

    @Authorized()
    @Get('/membershipproduct/details/:membershipProductId')
    async getMembershipProductDetails(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response,
        @Param("membershipProductId") membershipProductId: string) {
        // let userId = currentUser.id;
        if (membershipProductId) {
            if (organisationUniqueKey) {
                const getOrgDetail = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
                if (getOrgDetail) {
                    const ORGANISATION_ID = getOrgDetail.id;
                    try {
                        const productFound = await this.membershipProductService.findProductByUniqueId(membershipProductId);
                        if (isArrayPopulated(productFound)) {
                            const MembershipData = await this.getMembershipProductDataAfterSaving(membershipProductId, productFound[0].id, ORGANISATION_ID);
                            return response.status(200).send(MembershipData);
                        } else {
                            logger.error(`Unable to get Membership Product`);
                            return response.status(400).send({
                                name: 'unexpected_error', message: `Failed to get Membership Product with provided ID ${membershipProductId}`
                            });
                        }
                    } catch (err) {
                        logger.error(`Unable to get Membership Product ` + err);
                        return response.status(400).send({
                            err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Membership Product Details.' + err : 'Failed to get Membership Product Details.'
                        });
                    }
                }
            }
        } else {
            return response.status(400).send({
                errorCode: 1, message: 'Please pass membershipProductId as a Path parameter.'
            });
        }
    }

    @Authorized()
    @Get('/membershipproductdiscounttype/default')
    async getDefaultMembershipProductDiscountType(
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response): Promise<any> {
        try {
            const foundProductDiscountTypes = await this.membershipProductTypeDiscountTypeService.getDefaultDiscountTypes(1)
            if (isArrayPopulated(foundProductDiscountTypes)) {
                return response.status(200).send({
                    id: foundProductDiscountTypes,
                    errorCode: 0,
                    message: 'successfully get default Membership Product Discount Type'
                })
            } else {
                return response.status(200).send({
                    id: foundProductDiscountTypes,
                    errorCode: 1,
                    message: 'Cannot get default Membership Product Discount Type'
                })
            }
        } catch (err) {
            logger.error(`Unable to get default Membership Product Discount Type` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get default Membership Product discount types.' + err : 'Failed to get default Membership Product discount types.'
            });
        }
    }

    async getMembershipProductDataAfterSaving(ProductUniqueKey: string, productID: number, organisationId: number) {
        let MembershipData = Object.assign({});
        const foundMembershipProductAfterCreation = await this.membershipProductService.findProductById(ProductUniqueKey, organisationId);
        const foundTypes = await this.membershipProductTypeService.findProductTypes(productID, organisationId);
        const foundFees = await this.membershipProductFeesService.findProductFeesById(productID, organisationId);
        const foundDiscount = await this.membershipProductTypeDiscountService.findProductDiscountById(productID, organisationId);

        if (isArrayPopulated(foundMembershipProductAfterCreation)) MembershipData.membershipproduct = foundMembershipProductAfterCreation[0];
        else MembershipData.membershipproduct = [];

        if (isArrayPopulated(foundFees.result)) MembershipData.membershipproductfee = foundFees.result[0];
        else MembershipData.membershipproductfee = [];

        if (isArrayPopulated(foundDiscount)) MembershipData.membershipproductdiscount = foundDiscount[0];
        else MembershipData.membershipproductdiscount = [];

        if (isArrayPopulated(foundTypes)) MembershipData.membershipproducttypes = foundTypes[0];
        else MembershipData.membershipproducttypes = [];

        return MembershipData;
    }
}