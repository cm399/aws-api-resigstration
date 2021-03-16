export function validateReqFilter(input: any, label: string): any {
    switch (label) {
        case 'competitionUniqueKey':
            if (input == null || input == "") {
                return { errorCode: 5, message: 'CompetitionUniqueKey is Mandatory' }
            } else {
                return null;
            }
        case 'organisation':
            if (input == null || input == "" || input == 0) {
                return { errorCode: 6, message: 'Organisation Id is Mandatory' }
            } else {
                return null;
            }
        default:
            return null;
    }
}