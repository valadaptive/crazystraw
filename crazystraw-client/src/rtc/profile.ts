import {Buffer} from 'buffer';

import {AvroProfile, Profile as ProfileStructure} from '../schemas/profile';

class Profile {
    /**
     * Unique profile ID. Not used to identify a specific user; rather, it's used to tell when a profile has changed.
     * Different/updated profiles from the same user will have different IDs.
     */
    public id: string;
    /** Username. */
    public handle: string;
    /** Avatar image data. */
    public avatar: Blob | null;
    /** User profile biography / "about me". */
    public bio: string | null;

    constructor (
        id: string,
        handle: string,
        avatar: Blob | null,
        bio: string | null
    ) {
        this.id = id;
        this.handle = handle;
        this.avatar = avatar;
        this.bio = bio;
    }

    public async toBytes (): Promise<Uint8Array> {
        const avatar = this.avatar ? {bytes: Buffer.from(await this.avatar.arrayBuffer())} : null;
        const profileStruct: ProfileStructure = {
            id: this.id,
            handle: this.handle,
            avatar,
            bio: this.bio ? {string: this.bio} : null
        };

        const serializedProfile = AvroProfile.toBuffer(profileStruct);
        return serializedProfile;
    }

    public static fromBytes (data: Uint8Array): Profile {
        const parsedProfile = AvroProfile.fromBuffer(Buffer.from(data)) as ProfileStructure;

        return new Profile(
            parsedProfile.id,
            parsedProfile.handle,
            parsedProfile.avatar ? new Blob([parsedProfile.avatar.bytes]) : null,
            parsedProfile.bio?.string ?? null
        );
    }
}

export default Profile;
