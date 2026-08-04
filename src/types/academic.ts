export interface Section {
    name: string;
    displayno: number;
    createdtime?: string;
}

export interface SubjectItem {
    name: string;
    displayno: number;
    createdtime?: string;
}

export interface AcademicStructure {
    key: string;
    schoolkey: string;
    standardname: string;
    displayno: number;
    sections: Section[];
    subjects: SubjectItem[];
    createdtime?: string;
    updatedtime?: string;
}
