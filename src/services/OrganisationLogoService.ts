import { Service } from "typedi";
import BaseService from "./BaseService";
import { OrganisationLogo } from "../models/security/OrganisationLogo";
import { Organisation } from "../models/security/Organisation";

@Service()
export default class OrganisationLogoService extends BaseService<OrganisationLogo> {

    modelName(): string {
        return OrganisationLogo.name;
    }

    // public async updateOrganisationLogo(organisationId: number, fileUrl: string): Promise<any> {
    //     return await this.entityManager.query(
    //         `UPDATE wsa_users.organisationLogo SET logoUrl = ? WHERE organisationId = ? and isDeleted = 0`, [fileUrl, organisationId]);
    // }

    public async getOrganisationDetail(organisationUniqueKey: string): Promise<Organisation> {
        return await this.entityManager.createQueryBuilder(Organisation, 'o')
            .andWhere('o.organisationUniqueKey = :organisationUniqueKey', { organisationUniqueKey })
            .getOne();
    }

    public async findByOrganisationId(organisationId: number): Promise<OrganisationLogo> {
        return await this.entityManager.createQueryBuilder(OrganisationLogo, 'o')
            .andWhere('o.organisationId = :organisationId and o.isDeleted = 0', { organisationId })
            .getOne();
    }

}