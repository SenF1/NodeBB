import nconf from 'nconf';
import querystring from 'querystring';

import { Request, Response, NextFunction } from 'express';

import meta from '../meta';
import pagination from '../pagination';
import user from '../user';
import topics from '../topics';
import helpers from './helpers';



// The anys are typed because there is no way of determining the exact types of the arguments
// since other files are not translated to TS yet
/* eslint-disable @typescript-eslint/no-explicit-any */
interface Pagination {
    rel : any;
}

interface Breadcrumb {
    text: string;
}

interface Filter {
    selected: boolean;
}

interface UnreadData {
    topicCount: number;
    pageCount: number;
    pagination: Pagination;
    title: string;
    breadcrumbs?: Breadcrumb[];
    showSelect: boolean;
    showTopicTools: boolean;
    allCategoriesUrl: string;
    selectedCategory?: any;
    selectedCids?: number[];
    selectCategoryLabel: string;
    selectCategoryIcon: string;
    showCategorySelectLabel: boolean;
    filters: Filter[];
    selectedFilter?: Filter;
}

interface UnreadController {
    get: (
        req: Request & { uid: number },
        res: Response
      ) => Promise<void>;
    unreadTotal: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

const unreadController = {} as UnreadController;
const relative_path = nconf.get('relative_path') as string;

interface CategoryData {
    selectedCategory?: any;
    selectedCids?: number[];
}

interface UserSettings {
    topicsPerPage: number;
    usePagination: any;
}

type IsPrivileged = boolean;

unreadController.get = async function (req: Request & { uid: number }, res: Response): Promise<void> {
    const { cid } = req.query;
    const filter = req.query.filter || '';
    const [categoryData, userSettings, isPrivileged] = await Promise.all([
        helpers.getSelectedCategory(cid) as CategoryData,
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        user.getSettings(req.uid) as UserSettings,
        user.isPrivileged(req.uid) as IsPrivileged,
    ]);

    const page = parseInt(req.query.page as string, 10) || 1;

    const start = Math.max(0, (page - 1) * userSettings.topicsPerPage);
    const stop = start + userSettings.topicsPerPage - 1;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const data = (await topics.getUnreadTopics({
        cid: cid,
        uid: req.uid,
        start: start,
        stop: stop,
        filter: filter,
        query: req.query,
    })) as UnreadData;

    const isDisplayedAsHome = !(req.originalUrl.startsWith(`${relative_path}/api/unread`) || req.originalUrl.startsWith(`${relative_path}/unread`));
    const baseUrl = isDisplayedAsHome ? '' : 'unread';

    if (isDisplayedAsHome) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        data.title = meta.config.homePageTitle as string || '[[pages:home]]';
    } else {
        data.title = '[[pages:unread]]';
        data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[unread:title]]' }]);
    }

    data.pageCount = Math.max(1, Math.ceil(data.topicCount / userSettings.topicsPerPage));
    data.pagination = pagination.create(page, data.pageCount, req.query);
    // The next line calls router[verb] which is in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    helpers.addLinkTags({ url: 'unread', res: req.res, tags: data.pagination.rel });

    if (userSettings.usePagination && (page < 1 || page > data.pageCount)) {
        req.query.page = String(Math.max(1, Math.min(data.pageCount, page)));
        return helpers.redirect(res, `/unread?${querystring.stringify(req.query as querystring.ParsedUrlQueryInput)}`);
    }

    data.showSelect = true;
    data.showTopicTools = isPrivileged;
    data.allCategoriesUrl = `${baseUrl}${helpers.buildQueryString(req.query, 'cid', '')}`;
    data.selectedCategory = categoryData.selectedCategory as CategoryData;
    data.selectedCids = categoryData.selectedCids;
    data.selectCategoryLabel = '[[unread:mark_as_read]]';
    data.selectCategoryIcon = 'fa-inbox';
    data.showCategorySelectLabel = true;
    data.filters = helpers.buildFilters(baseUrl, filter, req.query);
    data.selectedFilter = data.filters.find(filter => filter && filter.selected);

    res.render('unread', data);
};

unreadController.unreadTotal = async function (req: Request & { uid: number }, res: Response, next: NextFunction) {
    const filter = req.query.filter || '';
    try {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const unreadCount = await topics.getTotalUnread(req.uid, filter) as number;
        res.json(unreadCount);
    } catch (err) {
        next(err);
    }
};


export = unreadController;
