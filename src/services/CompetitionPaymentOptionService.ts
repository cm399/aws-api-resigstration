import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import { CompetitionPaymentOption } from '../models/registrations/CompetitionPaymentOption';

@Service()
export default class CompetitionPaymentOptionService extends BaseService<CompetitionPaymentOption> {

    modelName(): string {
        return CompetitionPaymentOption.name;
    }

    public async getCompetitionFeePaymentOption(competitionID: number): Promise<any> {
      //  await this.entityManager.query(`SET SESSION group_concat_max_len = 819200`);
        const query = await this.entityManager.query(
            `SELECT CONCAT('[', (SELECT CAST(GROUP_CONCAT(JSON_OBJECT('feesTypeRefId', cpo.feesTypeRefId, 'paymentOptionRefId', 
            cpo.paymentOptionRefId, 'paymentOptionId', cpo.id, 'subOptions', (CONCAT('[', (SELECT CAST(GROUP_CONCAT(JSON_OBJECT(
            'competitionPaymentOptionId', cpo1.id, 'paymentOptionRefId', cpo1.paymentOptionRefId)) AS CHAR (819200)) FROM competitionPaymentOption 
            AS cpo1 WHERE cpo1.isDeleted = 0 and cpo1.paymentOptionRefId = cpo.id), ']')))) AS CHAR (819200)) FROM competitionPaymentOption 
            AS cpo JOIN competition AS c ON c.id = cpo.competitionId WHERE c.id = ? AND 
            c.isDeleted = 0 and cpo.isDeleted = 0 ), ']') AS paymentOptions, CONCAT('[', (SELECT  GROUP_CONCAT(
            JSON_OBJECT('charityRoundUpId',ccru.id, 'charityRoundUpName',ccru.name, 'charityRoundUpDescription',ccru.description, 'charityRoundUpRefId', ccru.charityRoundUpRefId)) FROM competitionCharityRoundUp AS 
            ccru JOIN competition AS c ON c.id = ccru.competitionId WHERE c.id = ? and 
            c.isDeleted = 0 and ccru.isDeleted = 0), ']') AS charityRoundUp, 
            CONCAT('[', (SELECT GROUP_CONCAT(JSON_OBJECT( 'paymentOptionRefId', cpi.paymentOptionRefId, 'paymentInstalmentId', cpi.id, 
            'instalmentDate', cpi.instalmentDate,'feesTypeRefId', cpi.feesTypeRefId ))
            from competitionPaymentInstalment cpi JOIN competition c ON c.id = cpi.competitionId where 
            c.id = ? and c.isDeleted = 0 and cpi.isDeleted = 0),']') as instalmentDates,
            CONCAT('[', (SELECT GROUP_CONCAT(JSON_OBJECT( 'paymentMethodId', cpm.id, 'paymentMethodRefId', cpm.paymentMethodRefId))
            from competitionPaymentMethod cpm JOIN competition c ON c.id = cpm.competitionId where 
            c.id = ? and c.isDeleted = 0 and cpm.isDeleted = 0),']') as paymentMethods`
            , [competitionID, competitionID, competitionID, competitionID]);

        if (isArrayPopulated(query)) {
            for (let r of query) {
                if (r['paymentOptions']) {
                    r['paymentOptions'] = JSON.parse(r['paymentOptions']);
                }
                if (r['charityRoundUp']) {
                    r['charityRoundUp'] = JSON.parse(r['charityRoundUp']);
                } else {
                    r['charityRoundUp'] = [];
                }
                if (r['instalmentDates']) {
                    r['instalmentDates'] = JSON.parse(r['instalmentDates']);
                } else {
                    r['instalmentDates'] = [];
                }
                if (r['paymentMethods']) {
                    r['paymentMethods'] = JSON.parse(r['paymentMethods']);
                } else {
                    r['paymentMethods'] = [];
                }
                
                if (isArrayPopulated(r['paymentOptions'])) {
                    for (let i of r['paymentOptions']) {
                        if (i['subOptions'] !== null) {
                            i['subOptions'] = JSON.parse(i['subOptions'])
                        } else {
                            i['subOptions'] = [];
                        }
                    }
                }

               
            }
        }
        return query
    }

    public async getIDForDeletePaymentOptByCompetitionId(competitionID: number): Promise<any> {
        return await this.entityManager.query(
            `select id from competitionPaymentOption where competitionId = ? and isDeleted = 0`, [competitionID])
    }

    public async checkPreviousPaymentOptions(competitionID: number): Promise<any> {
        return await this.entityManager.query(
            `select * from competitionPaymentOption where competitionId = ? and isDeleted = 0`, [competitionID]);
    }
}