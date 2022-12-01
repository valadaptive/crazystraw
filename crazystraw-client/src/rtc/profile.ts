import {toByteArray, fromByteArray} from 'base64-js';

import {PersonalIdentity} from './identity';

class Profile {
    public handle: string;
    public avatar: Blob | null;
    public bio: string | null;

    constructor (
        handle: string,
        avatar: Blob | null,
        bio: string | null
    ) {
        this.handle = handle;
        this.avatar = avatar;
        this.bio = bio;
    }
}

class PersonalProfile extends Profile {
    public identity: PersonalIdentity;
    public savedIdentity: Partial<Record<string, unknown>>;

    private constructor (
        identity: PersonalIdentity,
        savedIdentity: Partial<Record<string, unknown>>,
        handle: string,
        avatar: Blob | null,
        bio: string | null
    ) {
        super(handle, avatar, bio);
        this.identity = identity;
        this.savedIdentity = savedIdentity;
    }

    public async export (): Promise<string> {
        const avatar = this.avatar ? fromByteArray(new Uint8Array(await this.avatar.arrayBuffer())) : null;
        return JSON.stringify({
            identity: this.savedIdentity,
            handle: this.handle,
            avatar,
            bio: this.bio
        });
    }

    public static async import (json: string, password: string): Promise<PersonalProfile> {
        const parsedJson = JSON.parse(json) as Partial<Record<string, unknown>>;
        const {handle, bio, avatar: avatarStr, identity: identityJson} = parsedJson;
        if (
            typeof handle !== 'string' ||
            (typeof bio !== 'string' && bio !== null) ||
            (typeof avatarStr !== 'string' && avatarStr !== null) ||
            (typeof identityJson !== 'object' || identityJson === null)
        ) {
            throw new Error('Invalid JSON');
        }

        const identity = await PersonalIdentity.import(identityJson, password);
        const avatar = avatarStr ? new Blob([toByteArray(avatarStr)]) : null;

        return new PersonalProfile(identity, identityJson, handle, avatar, bio);
    }

    public static async create (profile: Profile, password: string): Promise<PersonalProfile> {
        const identity = await PersonalIdentity.generate();
        const savedIdentity = await identity.export(password);
        const {handle, avatar, bio} = profile;
        return new PersonalProfile(identity, savedIdentity, handle, avatar, bio);

    }
}

export {Profile, PersonalProfile};
