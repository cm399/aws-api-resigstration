import { Service } from "typedi";
import BaseService from "./BaseService";
import { CommunicationTrack } from "../models/common/CommunicationTrack";

@Service()
export default class CommunicationTrackService extends BaseService<CommunicationTrack> {

    modelName(): string {
        return CommunicationTrack.name;
    }
}